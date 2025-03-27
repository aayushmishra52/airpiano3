document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const video = document.getElementById('webcam');
    const outputCanvas = document.getElementById('output-canvas');
    const visualCanvas = document.getElementById('visual-effect');
    const startBtn = document.getElementById('start-btn');
    const showHandsCheckbox = document.getElementById('show-hands');
    const impressionistModeCheckbox = document.getElementById('impressionist-mode');
    const keys = document.querySelectorAll('.key');
    
    // Canvas setup
    const outputCtx = outputCanvas.getContext('2d');
    const visualCtx = visualCanvas.getContext('2d');
    
    // MediaPipe Hands setup
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });
    
    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });
    
    // Tone.js setup
    const synth = new Tone.PolySynth(Tone.Synth).toDestination();
    
    // Piano key zones (will be calculated based on canvas size)
    let keyZones = [];
    
    // Currently active notes
    const activeNotes = new Set();
    
    // Impressionist brushes
    const brushes = [
        { color: '#ff7675', size: 15, opacity: 0.6 },
        { color: '#74b9ff', size: 20, opacity: 0.5 },
        { color: '#55efc4', size: 25, opacity: 0.4 },
        { color: '#ffeaa7', size: 18, opacity: 0.5 },
        { color: '#a29bfe', size: 22, opacity: 0.5 }
    ];
    
    // Initialize camera
    function startCamera() {
        const camera = new Camera(video, {
            onFrame: async () => {
                await hands.send({ image: video });
            },
            width: 640,
            height: 360
        });
        camera.start();
    }
    
    // Calculate piano key zones based on canvas size
    function calculateKeyZones() {
        const canvasWidth = outputCanvas.width;
        const canvasHeight = outputCanvas.height;
        const keyHeight = canvasHeight * 0.3;
        const keyTop = canvasHeight - keyHeight;
        
        keyZones = [];
        
        // White keys
        const whiteKeys = Array.from(document.querySelectorAll('.key.white'));
        const whiteKeyWidth = canvasWidth / whiteKeys.length;
        
        whiteKeys.forEach((key, index) => {
            const note = key.dataset.note;
            keyZones.push({
                note: note,
                x: index * whiteKeyWidth,
                y: keyTop,
                width: whiteKeyWidth,
                height: keyHeight,
                element: key
            });
        });
        
        // Black keys
        const blackKeys = Array.from(document.querySelectorAll('.key.black'));
        const blackKeyWidth = whiteKeyWidth * 0.6;
        
        blackKeys.forEach(key => {
            const note = key.dataset.note;
            const leftOffset = parseFloat(key.style.left || getComputedStyle(key).left) / 100;
            
            keyZones.push({
                note: note,
                x: canvasWidth * leftOffset,
                y: keyTop,
                width: blackKeyWidth,
                height: keyHeight * 0.6,
                element: key
            });
        });
    }
    
    // Draw piano key zones on canvas (for debugging)
    function drawKeyZones() {
        outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        
        keyZones.forEach(zone => {
            outputCtx.fillStyle = zone.note.includes('#') ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
            outputCtx.fillRect(zone.x, zone.y, zone.width, zone.height);
            outputCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            outputCtx.strokeRect(zone.x, zone.y, zone.width, zone.height);
        });
    }
    
    // Play a note
    function playNote(note) {
        if (!activeNotes.has(note)) {
            synth.triggerAttack(note);
            activeNotes.add(note);
            
            // Highlight the key
            const keyElement = document.querySelector(`.key[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.add('active');
            }
        }
    }
    
    // Stop a note
    function stopNote(note) {
        if (activeNotes.has(note)) {
            synth.triggerRelease(note);
            activeNotes.delete(note);
            
            // Remove highlight from the key
            const keyElement = document.querySelector(`.key[data-note="${note}"]`);
            if (keyElement) {
                keyElement.classList.remove('active');
            }
        }
    }
    
    // Draw impressionist brush stroke
    function drawBrushStroke(x, y, fingerIndex) {
        if (!impressionistModeCheckbox.checked) return;
        
        const brush = brushes[fingerIndex % brushes.length];
        visualCtx.globalAlpha = brush.opacity;
        visualCtx.fillStyle = brush.color;
        
        // Draw a circle with random variations for impressionist effect
        const size = brush.size * (0.8 + Math.random() * 0.4);
        visualCtx.beginPath();
        visualCtx.arc(x, y, size, 0, Math.PI * 2);
        visualCtx.fill();
    }
    
    // Clear the visual canvas with a fade effect
    function fadeCanvas() {
        visualCtx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        visualCtx.fillRect(0, 0, visualCanvas.width, visualCanvas.height);
    }
    
    // Process hand landmarks
    hands.onResults(results => {
        // Resize canvases if needed
        if (outputCanvas.width !== video.videoWidth || outputCanvas.height !== video.videoHeight) {
            outputCanvas.width = video.videoWidth;
            outputCanvas.height = video.videoHeight;
            visualCanvas.width = video.videoWidth;
            visualCanvas.height = video.videoHeight;
            calculateKeyZones();
        }
        
        // Clear output canvas
        outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
        
        // Apply fade effect to visual canvas
        fadeCanvas();
        
        // Draw video frame (mirrored)
        if (showHandsCheckbox.checked) {
            outputCtx.save();
            outputCtx.translate(outputCanvas.width, 0);
            outputCtx.scale(-1, 1);
            outputCtx.drawImage(video, 0, 0, outputCanvas.width, outputCanvas.height);
            outputCtx.restore();
        }
        
        // Draw key zones
        drawKeyZones();
        
        // Track which notes should be active
        const notesToPlay = new Set();
        
        if (results.multiHandLandmarks) {
            for (const landmarks of results.multiHandLandmarks) {
                // Draw hand landmarks if enabled
                if (showHandsCheckbox.checked) {
                    for (let i = 0; i < landmarks.length; i++) {
                        const landmark = landmarks[i];
                        outputCtx.fillStyle = 'rgba(255, 0, 0, 0.8)';
                        outputCtx.beginPath();
                        outputCtx.arc(
                            outputCanvas.width - landmark.x * outputCanvas.width,
                            landmark.y * outputCanvas.height,
                            5,
                            0,
                            Math.PI * 2
                        );
                        outputCtx.fill();
                    }
                }
                
                // Check fingertips (indices 4, 8, 12, 16, 20)
                const fingertips = [4, 8, 12, 16, 20];
                
                for (let i = 0; i < fingertips.length; i++) {
                    const landmark = landmarks[fingertips[i]];
                    // Mirror the x coordinate
                    const x = outputCanvas.width - landmark.x * outputCanvas.width;
                    const y = landmark.y * outputCanvas.height;
                    
                    // Draw impressionist brush stroke
                    drawBrushStroke(x, y, i);
                    
                    // Check if fingertip is in a key zone
                    for (const zone of keyZones) {
                        if (
                            x >= zone.x && 
                            x <= zone.x + zone.width && 
                            y >= zone.y && 
                            y <= zone.y + zone.height
                        ) {
                            notesToPlay.add(zone.note);
                            break;
                        }
                    }
                }
            }
        }
        
        // Update playing notes
        for (const note of activeNotes) {
            if (!notesToPlay.has(note)) {
                stopNote(note);
            }
        }
        
        for (const note of notesToPlay) {
            if (!activeNotes.has(note)) {
                playNote(note);
            }
        }
    });
    
    // Start button click handler
    startBtn.addEventListener('click', async () => {
        try {
            // Request audio context to be resumed
            await Tone.start();
            startCamera();
            startBtn.disabled = true;
            startBtn.textContent = 'Air Piano Active';
        } catch (error) {
            console.error('Error starting the air piano:', error);
            alert('Could not start the air piano. Please make sure you have granted camera permissions.');
        }
    });
    
    // Add click events to piano keys for testing
    keys.forEach(key => {
        key.addEventListener('mousedown', () => {
            const note = key.dataset.note;
            playNote(note);
        });
        
        key.addEventListener('mouseup', () => {
            const note = key.dataset.note;
            stopNote(note);
        });
        
        key.addEventListener('mouseleave', () => {
            const note = key.dataset.note;
            stopNote(note);
        });
    });
    
    // Initialize canvas sizes
    function resizeCanvases() {
        const videoContainer = document.querySelector('.video-container');
        const containerWidth = videoContainer.clientWidth;
        const containerHeight = videoContainer.clientHeight;
        
        outputCanvas.width = containerWidth;
        outputCanvas.height = containerHeight;
        visualCanvas.width = containerWidth;
        visualCanvas.height = containerHeight;
        
        calculateKeyZones();
    }
    
    // Initial resize
    window.addEventListener('resize', resizeCanvases);
    resizeCanvases();
});