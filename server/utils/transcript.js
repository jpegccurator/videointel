const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function parseVTT(content) {
  const lines = content.split('\n');
  const textLines = [];
  let lastLine = '';

  for (const line of lines) {
    if (
      line.startsWith('WEBVTT') ||
      line.startsWith('Kind:') ||
      line.startsWith('Language:') ||
      line.includes('-->') ||
      line.trim() === '' ||
      /^\d+$/.test(line.trim()) ||
      /^\d{2}:\d{2}/.test(line.trim())
    ) {
      continue;
    }
    const clean = line.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
    if (clean && clean !== lastLine) {
      textLines.push(clean);
      lastLine = clean;
    }
  }

  return textLines.join(' ');
}

function parseSRT(content) {
  const lines = content.split('\n');
  const textLines = [];
  let lastLine = '';

  for (const line of lines) {
    if (
      line.includes('-->') ||
      line.trim() === '' ||
      /^\d+$/.test(line.trim())
    ) {
      continue;
    }
    const clean = line.replace(/<[^>]+>/g, '').trim();
    if (clean && clean !== lastLine) {
      textLines.push(clean);
      lastLine = clean;
    }
  }

  return textLines.join(' ');
}

async function getTranscript(url, apiKey) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'videointel-'));

  try {
    // Get video metadata
    const metaJson = execSync(`yt-dlp --dump-json "${url}"`, {
      encoding: 'utf-8',
      timeout: 30000,
    });
    const rawMeta = JSON.parse(metaJson);

    const videoMeta = {
      title: rawMeta.title || 'Unknown Title',
      channel: rawMeta.channel || rawMeta.uploader || 'Unknown Channel',
      duration: rawMeta.duration || 0,
      publishDate: rawMeta.upload_date
        ? `${rawMeta.upload_date.slice(0, 4)}-${rawMeta.upload_date.slice(4, 6)}-${rawMeta.upload_date.slice(6, 8)}`
        : 'Unknown',
      thumbnail: rawMeta.thumbnail || '',
      videoId: rawMeta.id || '',
    };

    // Try to get auto-captions
    let transcript = null;

    try {
      execSync(
        `yt-dlp --write-auto-sub --write-sub --sub-lang en --skip-download -o "${path.join(tmpDir, '%(id)s')}" "${url}"`,
        { encoding: 'utf-8', timeout: 30000 }
      );

      const files = fs.readdirSync(tmpDir);
      const vttFile = files.find((f) => f.endsWith('.vtt'));
      const srtFile = files.find((f) => f.endsWith('.srt'));

      if (vttFile) {
        const content = fs.readFileSync(path.join(tmpDir, vttFile), 'utf-8');
        transcript = parseVTT(content);
      } else if (srtFile) {
        const content = fs.readFileSync(path.join(tmpDir, srtFile), 'utf-8');
        transcript = parseSRT(content);
      }
    } catch (e) {
      // Captions not available, will use Whisper fallback
    }

    if (transcript && transcript.trim().length > 50) {
      return { transcript, videoMeta };
    }

    // Fallback: download audio and use Whisper
    if (!apiKey) {
      throw new Error('No API key set. Cannot use Whisper fallback for transcription.');
    }

    execSync(
      `yt-dlp -x --audio-format mp3 --audio-quality 5 -o "${path.join(tmpDir, 'audio.%(ext)s')}" "${url}"`,
      { encoding: 'utf-8', timeout: 120000 }
    );

    const audioPath = path.join(tmpDir, 'audio.mp3');
    if (!fs.existsSync(audioPath)) {
      throw new Error('Failed to download audio for transcription.');
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const audioFile = fs.createReadStream(audioPath);
    const whisperResponse = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: audioFile,
      response_format: 'text',
    });

    transcript = typeof whisperResponse === 'string' ? whisperResponse : whisperResponse.text;

    return { transcript, videoMeta };
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup failed, not critical
    }
  }
}

module.exports = { getTranscript };
