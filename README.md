# MathCAT Read-Aloud Player

A Web Component that synchronizes human audio narration with HTML text and MathML equations. When audio reaches a math block, it pauses, uses MathCAT (Rust/WASM) to generate speech, and resumes the human audio.

##  How to Test Manually

Because the project uses ES Modules and WebAssembly, **you must run it on a local server**. Opening `index.html` directly will fail.

1. Open your terminal and navigate to the project folder.
2. Start a local server:
   ```bash
   # Using Python 3
   python3 -m http.server 8000
   
   # OR using Node.js
   npx serve
 3.Open your browser and go to http://localhost:8000  
 <img width="1828" height="930" alt="Screenshot From 2026-11-05 19-53-56" src="https://github.com/user-attachments/assets/4875ecaa-d328-4d06-b982-2422a0f583e2" />
