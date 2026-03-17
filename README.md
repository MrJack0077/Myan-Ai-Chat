<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0d0e0386-63aa-41e1-aa9c-1835020d728c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## VPS Deployment

To deploy this project on a VPS, you have two main options:

### Option 1: Using Docker (Recommended)

Docker makes it easy to run the app in a consistent environment.

1. **Build the image:**
   `docker build -t my-ai-app .`

2. **Run the container:**
   `docker run -d -p 3000:3000 --env-file .env my-ai-app`

### Option 2: Manual Setup

1. **Install Node.js 22+** (Required for native TypeScript support).
2. **Clone the repository** to your VPS.
3. **Install dependencies:**
   `npm install`
4. **Build the frontend:**
   `npm run build`
5. **Start the production server:**
   `npm start`

### Environment Variables

Make sure to set the following environment variables in your `.env` file or VPS environment:
- `GEMINI_API_KEY`: Your Google Gemini API key.
- `VITE_FIREBASE_API_KEY`: Your Firebase API key.
- (And other Firebase variables listed in `.env.example`)
