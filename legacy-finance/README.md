# Finance AI Dashboard

A web app that generates AI-powered financial reports. Enter company financial data into the form, click Generate, and get a structured summary report shown as a dashboard.

## How it works
- `index.html` is the web page with input fields and a button.
- `api/generate.py` is the backend function that sends your data to Claude and returns a report.
- `requirements.txt` tells Vercel to install the Anthropic library.
- `vercel.json` tells Vercel how to run the backend function.

## Setup on Vercel
1. Upload all these files into a GitHub repository (keep the folder structure exactly as-is: `api/generate.py` must stay inside a folder named `api`).
2. Go to vercel.com, sign in, and import that GitHub repository as a new project.
3. Before deploying, go to the project's Settings → Environment Variables, and add one variable:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your API key from console.anthropic.com
4. Deploy. Vercel will give you a live URL.
5. Open the URL, fill in the form, and click Generate Report.

## Important
Never put your API key directly into any file. It only goes into Vercel's Environment Variables setting, entered through the Vercel website itself.
