# VideoIntel — YouTube Video Intelligence Pipeline

A full-stack React + Node.js web application that transcribes YouTube videos, extracts every data point and statistic, verifies each one against real sources using GPT-4o, and stores analyzed videos in a searchable library. Includes a Show Generator that combines data from multiple videos into YouTube show concepts.

## Prerequisites

- **Node.js** 18+
- **yt-dlp** — Install with `brew install yt-dlp` or `pip install yt-dlp`
- **OpenAI API Key** — You'll be prompted to enter this on first launch

## Setup

```bash
npm install
```

## Run

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

### Analyze Tab
- Paste any YouTube URL to transcribe and analyze
- AI extracts every data point and statistic from the video
- Each claim is verified against real sources with traffic-light badges (green/amber/red)
- Chartable data points show trend visualizations
- Save analyzed videos to your Library

### Library Tab
- Search and filter all analyzed videos by title, tags, or data points
- Expand any video to see the full analysis dashboard
- Select multiple videos to send to the Show Generator

### Show Generator Tab
- Generates YouTube show concepts from multiple analyzed videos
- Lock/unlock individual elements (title, thumbnail, synopsis)
- Regenerate unlocked elements while keeping locked ones
- Browse up to 5 versions of generated content
- All elements are editable inline

## Tech Stack

- **Frontend:** React 18 + Vite
- **Backend:** Node.js + Express
- **AI:** OpenAI GPT-4o with web search for verification
- **Transcription:** yt-dlp (with Whisper API fallback)
- **Storage:** IndexedDB (browser-local, no external database)
- **Charts:** Recharts

---

Built by [@alessandrorisk](https://twitter.com/alessandrorisk)
