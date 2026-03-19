const video = document.getElementById("camera");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

let model;
let currentLanguage = "en";
let isNavigating = false;
let stream;
let currentFacingMode = "environment";

// 🎥 CAMERA
async function startCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());

  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: currentFacingMode }
  });

  video.srcObject = stream;
}

// 🔄 FLIP CAMERA
function flipCamera() {
  currentFacingMode =
    currentFacingMode === "environment" ? "user" : "environment";
  startCamera();
}

// 📦 LOAD MODEL
async function loadModel() {
  model = await cocoSsd.load();
}

// 🌍 LANGUAGE
document.getElementById("language").addEventListener("change", function () {
  currentLanguage = this.value;
});

// ✍️ TEXT
function typeText(text) {
  document.getElementById("output").innerText = text;
}

// 📏 DISTANCE
function getDistance(size) {
  if (size > 200000) return "very close";
  if (size > 80000) return "near";
  return "far";
}

// 🧠 DETECT WITH GUIDANCE
async function detectWithGuidance() {
  const predictions = await model.detect(video);

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (predictions.length === 0) {
    return { objects: [], direction: "safe" };
  }

  const main = predictions[0];
  const [x, y, w, h] = main.bbox;

  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);

  const centerX = x + w / 2;
  const screenCenter = canvas.width / 2;

  let direction;

  if (centerX < screenCenter - 100) direction = "left";
  else if (centerX > screenCenter + 100) direction = "right";
  else direction = "center";

  return {
    objects: predictions.map(p => p.class),
    mainObject: main.class,
    direction: direction,
    distance: getDistance(w * h)
  };
}

// 🧭 NAVIGATION
async function startNavigation() {
  isNavigating = true;

  while (isNavigating) {
    const data = await detectWithGuidance();
    let text;

    if (data.objects.length === 0) {
      text = "Path is clear";
    } else {
      if (data.direction === "center") {
        text = `Stop. ${data.mainObject} ${data.distance}`;
      } else if (data.direction === "left") {
        text = "Obstacle left. Move right";
      } else {
        text = "Obstacle right. Move left";
      }
    }

    typeText(text);
    speak(text);

    await new Promise(r => setTimeout(r, 2000));
  }
}

function stopNavigation() {
  isNavigating = false;
}

// 📸 SCAN
async function scan() {
  const data = await detectWithGuidance();

  let text =
    data.objects.length === 0
      ? "Nothing detected"
      : `I can see ${data.objects.join(", ")}`;

  typeText(text);
  speak(text);
}

// 🧠 AI CHAT (FIXED)
async function handleQuestion(type) {
  const data = await detectWithGuidance();

  let response;

  if (type === "what") {
    response =
      data.objects.length === 0
        ? "I see nothing"
        : `I can see ${data.objects.join(", ")}`;
  }

  else if (type === "where") {
    if (data.direction === "left") response = "Move right";
    else if (data.direction === "right") response = "Move left";
    else response = "Stop or move carefully";
  }

  else if (type === "safe") {
    response =
      data.objects.length === 0
        ? "Yes, it is safe"
        : "No, obstacle detected";
  }

  else if (type === "front") {
    response =
      data.objects.length === 0
        ? "Nothing ahead"
        : `Yes, ${data.mainObject} ahead`;
  }

  typeText(response);
  speak(response);
}

// 🚨 EMERGENCY
function emergency() {
  speak("Emergency alert activated");
}

// 🔊 SPEAK
async function speak(text) {
  speechSynthesis.cancel();

  try {
    const res = await fetch("https://api.murf.ai/v1/speech/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": "YOUR_API_KEY"
      },
      body: JSON.stringify({
        voiceId: "en-US-natalie",
        text: text
      })
    });

    const data = await res.json();

    if (data.audioFile) {
      new Audio(data.audioFile).play();
    } else {
      throw "fail";
    }

  } catch {
    const msg = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(msg);
  }
}

// 🎤 SMART VOICE COMMANDS (FIXED 🔥)
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.continuous = true;

recognition.onresult = function (event) {

  const cmd = event.results[event.results.length - 1][0].transcript.toLowerCase();

  console.log("User said:", cmd);

  // basic controls
  if (cmd.includes("start")) return startNavigation();
  if (cmd.includes("stop")) return stopNavigation();
  if (cmd.includes("scan")) return scan();
  if (cmd.includes("emergency")) return emergency();

  // smart questions
  if (cmd.includes("what") || cmd.includes("see")) return handleQuestion("what");
  if (cmd.includes("where") || cmd.includes("go")) return handleQuestion("where");
  if (cmd.includes("safe") || cmd.includes("clear")) return handleQuestion("safe");
  if (cmd.includes("front") || cmd.includes("ahead")) return handleQuestion("front");

  // fallback
  speak("I did not understand");
};

recognition.start();

// 🚀 INIT
window.onload = async () => {
  await startCamera();
  await loadModel();
};
