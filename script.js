// Global Variables
var video = document.getElementById("video");
var captureBtn = document.getElementById("capture-btn");
var timerInput = document.getElementById("timer");
var countdownDisplay = document.getElementById("countdown-display");
var flash = document.getElementById("flash");
var overlayCanvas = document.getElementById("overlay-canvas");
var previewCanvas = document.getElementById("preview-canvas");
var photoGrid = document.getElementById("photo-grid");
var btnRetake = document.getElementById("btn-retake");
var btnSave = document.getElementById("btn-save");
var rightSide = document.getElementById("right-side");
var container = document.querySelector(".container");

var btnSaveVideo = document.getElementById("btn-save-video");
var btnPauseAnim = document.getElementById("btn-pause-anim");


// Audio Context for Ticking
var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTick() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.1);
}

function playVoicePrompt() {
    var msg = new SpeechSynthesisUtterance("Smile!");
    msg.rate = 1.2;
    window.speechSynthesis.speak(msg);
}

let animationFrameId = null;
let currentAnimFrame = 0;
let isAnimPaused = false;

btnPauseAnim.addEventListener("click", () => {
    isAnimPaused = !isAnimPaused;
    if (isAnimPaused) {
        btnPauseAnim.innerHTML = '<span><i class="fas fa-play"></i> Play</span>';
    } else {
        btnPauseAnim.innerHTML = '<span><i class="fas fa-pause"></i> Pause</span>';
    }
});

// New variables for stickers
var stickerLayer = document.getElementById("sticker-layer");
var stickerList = document.getElementById("sticker-list");
var canvasWrapper = document.getElementById("canvas-wrapper");
var activeSticker = null;

// Settings
var selectedFrames = 4;
var selectedFilter = "none";
var selectedTemplate = "classic";
var selectedDecoration = "none";
var selectedBackground = "black";
var capturedPhotos = [];
var currentPhotoIndex = null;

// Background color mapping
const backgroundColors = {
    'black': '#000000',
    'white': '#FFFFFF',
    'navy': '#1a1a2e',
    'maroon': '#800020',
    'burgundy': '#6B1515',
    'charcoal': '#36454F',
    'forest': '#2C5F2D',
    'midnight': '#191970'
};

// Initialize Camera
navigator.mediaDevices.getUserMedia({ 
    video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 }
    } 
}).then((stream) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => {
        overlayCanvas.width = video.videoWidth;
        overlayCanvas.height = video.videoHeight;
    };
}).catch((err) => {
    console.error("Camera error:", err);
    alert("Tidak bisa mengakses kamera. Pastikan kamera diizinkan!");
});

// Frame Selection
document.querySelectorAll('.frame-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.frame-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFrames = parseInt(btn.getAttribute('data-frames'));
    });
});

// Filter Selection
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFilter = btn.getAttribute('data-filter');
        applyFilterToVideo();
    });
});

// Apply Filter to Video Preview
function applyFilterToVideo() {
    const filterClasses = ['filter-none', 'filter-grayscale', 'filter-sepia', 'filter-vintage', 'filter-warm'];
    video.classList.remove(...filterClasses);
    video.classList.add(`filter-${selectedFilter}`);
}


// Shutter Sound
function playShutter() {
    try {
        var audio = new Audio("camera.mp3");
        audio.play().catch(() => {
            // Jika file audio tidak ada, skip saja
        });
    } catch (e) {
        // Skip jika error
    }
}

// Capture Button Click
captureBtn.addEventListener("click", () => {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    let delay = parseInt(timerInput.value) || 3;
    startSequence(delay);
});

// Spacebar to Take Photo
document.addEventListener('keydown', (e) => {
    // Only trigger if focus is not in an input and we haven't started capturing yet
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); // prevent page scrolling
        if (!captureBtn.disabled && !container.classList.contains("has-preview")) {
            captureBtn.click();
        }
    }
});

// Start Photo Sequence
function startSequence(delay) {
    captureBtn.disabled = true;
    capturedPhotos = [];
    let count = 0;

    function doShoot() {
        showCountdown(delay);

        setTimeout(async () => {
            await takePhotoAsync();
            count++;

            if (count < selectedFrames) {
                doShoot();
            } else {
                setTimeout(() => {
                    showPreview();
                    captureBtn.disabled = false;
                    countdownDisplay.textContent = "";
                }, 300);
            }
        }, delay * 1000);
    }

    doShoot();
}

// Countdown Timer
function showCountdown(sec) {
    let timer = sec;
    countdownDisplay.style.display = "block";
    countdownDisplay.textContent = timer;
    playTick();
    
    let countdown = setInterval(() => {
        timer--;
        countdownDisplay.textContent = timer <= 0 ? "📸" : timer;
        
        if (timer > 0) {
            playTick();
            if (timer === 1) {
                playVoicePrompt();
            }
        }
        
        if (timer <= 0) {
            clearInterval(countdown);
            setTimeout(() => {
                countdownDisplay.textContent = "";
            }, 200);
        }
    }, 1000);
}

// Take Photo Asynchronously (Live Photo capture)
function takePhotoAsync() {
    return new Promise((resolve) => {
        flashEffect();
        playShutter();

        let frames = [];
        let maxFrames = 10;
        let captureCount = 0;

        let interval = setInterval(() => {
            var canvas = document.createElement("canvas");
            var ctx = canvas.getContext("2d");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            // Mirror the video
            ctx.scale(-1, 1);
            ctx.drawImage(video, -canvas.width, 0);

            // Apply filter
            if (selectedFilter !== "none") {
                applyCanvasFilter(ctx, canvas);
            }

            frames.push(canvas);
            captureCount++;

            if (captureCount >= maxFrames) {
                clearInterval(interval);
                capturedPhotos.push(frames);
                resolve();
            }
        }, 100); // 100ms * 10 = 1000ms duration
    });
}

// Apply Filter to Canvas
function applyCanvasFilter(ctx, canvas) {
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let data = imageData.data;

    switch (selectedFilter) {
        case "grayscale":
            for (let i = 0; i < data.length; i += 4) {
                let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
                data[i] = data[i + 1] = data[i + 2] = avg;
            }
            break;
        case "sepia":
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
                data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
                data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
            }
            break;
        case "vintage":
            for (let i = 0; i < data.length; i += 4) {
                let r = data[i];
                let g = data[i + 1];
                let b = data[i + 2];
                data[i] = Math.min(255, (r * 0.393 + g * 0.769 + b * 0.189) * 0.9);
                data[i + 1] = Math.min(255, (r * 0.349 + g * 0.686 + b * 0.168) * 0.9);
                data[i + 2] = Math.min(255, (r * 0.272 + g * 0.534 + b * 0.131) * 0.9);
            }
            break;
        case "warm":
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] * 1.2);
                data[i + 1] = Math.min(255, data[i + 1] * 1.05);
            }
            break;
    }

    ctx.putImageData(imageData, 0, 0);
}

// Flash Effect
function flashEffect() {
    flash.classList.add("active");
    setTimeout(() => {
        flash.classList.remove("active");
    }, 150);
}

// Show Preview on Right Side
function showPreview() {
    createStoryGrid(capturedPhotos, 0);
    
    // Show right side
    rightSide.classList.add("active");
    container.classList.add("has-preview");
    
    initStickerPicker();
    
    // Template Selection - Reset event listeners
    document.querySelectorAll('.template-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.template-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedTemplate = this.getAttribute('data-template');
        });
    });

    // Background Color Selection - Reset event listeners
    document.querySelectorAll('.bg-color-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    document.querySelectorAll('.bg-color-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.bg-color-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedBackground = this.getAttribute('data-bg');
        });
    });

    // Decoration Selection - Reset event listeners
    document.querySelectorAll('.deco-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    document.querySelectorAll('.deco-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.deco-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedDecoration = this.getAttribute('data-deco');
        });
    });
    
    // Create thumbnails
    photoGrid.innerHTML = "";
    capturedPhotos.forEach((photoSequence, index) => {
        let photo = Array.isArray(photoSequence) ? photoSequence[0] : photoSequence;
        let div = document.createElement("div");
        div.className = "photo-thumbnail";
        div.innerHTML = `
            <img src="${photo.toDataURL()}" alt="Photo ${index + 1}">
            <div class="retake-overlay"><i class="fas fa-redo"></i></div>
        `;
        div.addEventListener("click", () => retakeSinglePhoto(index));
        photoGrid.appendChild(div);
    });

    // Start Live Photo Animation Loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    animatePreview();
}

// Live Photo Animation Loop
function animatePreview() {
    if (rightSide.classList.contains("active")) {
        if (!isAnimPaused) {
            createStoryGrid(capturedPhotos, Math.floor(currentAnimFrame / 6));
            currentAnimFrame++;
        }
        animationFrameId = requestAnimationFrame(animatePreview);
    }
}

// Create Photo Strip with proper layout
function createStoryGrid(photos, frameIndex = 0) {
    const ctx = previewCanvas.getContext("2d");
    const photoCount = photos.length;
    
    // Determine layout based on photo count
    let layout = {};
    
    if (photoCount === 3 || photoCount === 4) {
        // Vertical layout (1 column)
        layout = {
            columns: 1,
            rows: photoCount,
            photoWidth: 540,
            photoHeight: 320,
            sidePadding: 50,
            topPadding: 50,
            horizontalSpacing: 0,
            verticalSpacing: 30,
            footerHeight: 120,  // Increased footer height
            bottomPadding: 40   // Extra space at bottom
        };
    } else if (photoCount === 6) {
        // Grid layout (2 columns x 3 rows)
        layout = {
            columns: 2,
            rows: 3,
            photoWidth: 260,
            photoHeight: 180,
            sidePadding: 50,
            topPadding: 50,
            horizontalSpacing: 20,
            verticalSpacing: 20,
            footerHeight: 120,  // Increased footer height
            bottomPadding: 40   // Extra space at bottom
        };
    }
    
    // Calculate canvas dimensions with proper spacing
    const canvasWidth = (layout.photoWidth * layout.columns) + (layout.horizontalSpacing * (layout.columns - 1)) + (layout.sidePadding * 2);
    const canvasHeight = (layout.photoHeight * layout.rows) + (layout.verticalSpacing * (layout.rows - 1)) + layout.topPadding + layout.footerHeight + layout.bottomPadding;
    
    previewCanvas.width = canvasWidth;
    previewCanvas.height = canvasHeight;
    
    // Draw background
    drawBackground(ctx);
    
    // Draw photos in grid
    let photoIndex = 0;
    for (let row = 0; row < layout.rows; row++) {
        for (let col = 0; col < layout.columns; col++) {
            if (photoIndex >= photos.length) break;
            
            const photoSequence = photos[photoIndex];
            const photo = Array.isArray(photoSequence) ? photoSequence[frameIndex % photoSequence.length] : photoSequence;
            const x = layout.sidePadding + (col * (layout.photoWidth + layout.horizontalSpacing));
            const y = layout.topPadding + (row * (layout.photoHeight + layout.verticalSpacing));
            
            // Calculate crop to maintain proper aspect ratio
            const sourceRatio = photo.width / photo.height;
            const targetRatio = layout.photoWidth / layout.photoHeight;
            
            let sourceX = 0, sourceY = 0, sourceWidth = photo.width, sourceHeight = photo.height;
            
            if (sourceRatio > targetRatio) {
                sourceWidth = photo.height * targetRatio;
                sourceX = (photo.width - sourceWidth) / 2;
            } else {
                sourceHeight = photo.width / targetRatio;
                sourceY = (photo.height - sourceHeight) / 2;
            }
            
            // Add frame/border effect based on template
            let frameColor = '#FFFFFF';
            let borderWidth = 10;
            switch(selectedTemplate) {
                case 'classic': frameColor = '#000000'; break;
                case 'retro': frameColor = '#800020'; break;
                case 'checkerboard': frameColor = '#1a1a2e'; break;
                case 'rainbow': frameColor = '#0f3460'; break;
                case 'hearts': frameColor = '#6B1515'; break;
                case 'stars': frameColor = '#191970'; break;
                case 'flowers': frameColor = '#4A5568'; break;
                case 'polaroid': frameColor = '#FFFFFF'; borderWidth = 15; break;
                case 'doodle': frameColor = '#FFFFFF'; break;
                case 'minimal': frameColor = '#FFFFFF'; borderWidth = 4; break;
            }
            
            ctx.fillStyle = frameColor;
            ctx.fillRect(x - borderWidth, y - borderWidth, layout.photoWidth + borderWidth * 2, layout.photoHeight + borderWidth * 2);
            
            if (selectedTemplate === 'doodle') {
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 2;
                ctx.setLineDash([12, 8]);
                ctx.strokeRect(x - borderWidth, y - borderWidth, layout.photoWidth + borderWidth * 2, layout.photoHeight + borderWidth * 2);
                ctx.setLineDash([]);
            }
            
            // Save context state
            ctx.save();
            
            // Create rounded rectangle path for photo
            const borderRadius = 12; // Border radius for photos
            ctx.beginPath();
            ctx.moveTo(x + borderRadius, y);
            ctx.lineTo(x + layout.photoWidth - borderRadius, y);
            ctx.quadraticCurveTo(x + layout.photoWidth, y, x + layout.photoWidth, y + borderRadius);
            ctx.lineTo(x + layout.photoWidth, y + layout.photoHeight - borderRadius);
            ctx.quadraticCurveTo(x + layout.photoWidth, y + layout.photoHeight, x + layout.photoWidth - borderRadius, y + layout.photoHeight);
            ctx.lineTo(x + borderRadius, y + layout.photoHeight);
            ctx.quadraticCurveTo(x, y + layout.photoHeight, x, y + layout.photoHeight - borderRadius);
            ctx.lineTo(x, y + borderRadius);
            ctx.quadraticCurveTo(x, y, x + borderRadius, y);
            ctx.closePath();
            ctx.clip();
            
            // Draw the photo with rounded corners
            ctx.drawImage(photo, sourceX, sourceY, sourceWidth, sourceHeight, x, y, layout.photoWidth, layout.photoHeight);
            
            // Restore context
            ctx.restore();
            
            photoIndex++;
        }
    }
    
    // Draw footer
    drawTemplateFooter(ctx);

    if(canvasWrapper) {
        canvasWrapper.style.aspectRatio = `${canvasWidth} / ${canvasHeight}`;
    }
}

// Draw Template Footer
function drawTemplateFooter(ctx) {
    const bgColor = backgroundColors[selectedBackground] || '#000000';
    const isLight = selectedBackground === 'white';
    const textColor = isLight ? '#333333' : '#FFFFFF';
    
    const footerY = previewCanvas.height - 30; // 30px from bottom
    ctx.fillStyle = textColor;
    ctx.font = '500 20px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("Created by Syafizam🎧", previewCanvas.width / 2, footerY);
}

// Draw Background
function drawBackground(ctx) {
    const bgColor = backgroundColors[selectedBackground] || '#000000';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    
    // Add decorations (includes character decorations now)
    addDecorations(ctx, capturedPhotos.length);
}

// Add Decorations based on selection
function addDecorations(ctx, photoCount) {
    const canvasHeight = previewCanvas.height - 120; // Stop before footer area
    const isLight = selectedBackground === 'white';
    
    // Use white color for all decorations
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    
    switch (selectedDecoration) {
        case "butterflies":
            ctx.fillStyle = '#FFFFFF';
            ctx.font = "30px Arial";
            const butterflyPositions = [
                {x: 25, y: 45},
                {x: previewCanvas.width - 55, y: 65},
                {x: 20, y: canvasHeight - 35},
                {x: previewCanvas.width - 50, y: canvasHeight - 55}
            ];
            
            butterflyPositions.forEach(pos => {
                ctx.fillText("🦋", pos.x, pos.y);
            });
            break;
            
        case "sparkles":
            ctx.fillStyle = '#FFFFFF';
            ctx.font = "24px Arial";
            const sparkles = ["✨", "⭐", "💫", "🌟"];
            for (let i = 0; i < 10; i++) {
                let x = 15 + Math.random() * (previewCanvas.width - 30);
                let y = 50 + Math.random() * (canvasHeight - 100);
                let sparkle = sparkles[Math.floor(Math.random() * sparkles.length)];
                ctx.fillText(sparkle, x, y);
            }
            break;
            
        case "stickers":
            ctx.fillStyle = '#FFFFFF';
            ctx.font = "26px Arial";
            const stickers = ["🌈", "💝", "🎀", "🦄", "🍭", "🎨", "💕", "🌸"];
            for (let i = 0; i < 8; i++) {
                let x = 15 + Math.random() * (previewCanvas.width - 30);
                let y = 50 + Math.random() * (canvasHeight - 100);
                let sticker = stickers[Math.floor(Math.random() * stickers.length)];
                ctx.fillText(sticker, x, y);
            }
            break;
            
        case "music":
            // Music theme: ⋆.˚, ✮, 🎧 scattered - INCREASED COUNT
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const musicSymbols = ["⋆.˚", "✮", "🎧"];
            const musicCount = 30; // Increased from 15 to 30
            
            for (let i = 0; i < musicCount; i++) {
                const symbol = musicSymbols[i % musicSymbols.length];
                const fontSize = symbol === "🎧" ? 28 : 32;
                ctx.font = `${fontSize}px Arial`;
                
                let x = 20 + Math.random() * (previewCanvas.width - 40);
                let y = 40 + Math.random() * (canvasHeight - 80);
                
                ctx.fillText(symbol, x, y);
            }
            break;
            
        case "cute":
            // Cute theme: 𐙚, ⋆.˚ scattered - INCREASED COUNT
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const cuteSymbols = ["𐙚", "⋆.˚"];
            const cuteCount = 25; // Increased from 12 to 25
            
            for (let i = 0; i < cuteCount; i++) {
                const symbol = cuteSymbols[i % cuteSymbols.length];
                ctx.font = "36px Arial";
                
                let x = 20 + Math.random() * (previewCanvas.width - 40);
                let y = 40 + Math.random() * (canvasHeight - 80);
                
                ctx.fillText(symbol, x, y);
            }
            break;
            
        case "spider":
            // Spider theme: 🕷️, 🕸, ✮ scattered - INCREASED COUNT
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const spiderSymbols = ["🕷️", "🕸", "✮"];
            const spiderCount = 30; // Increased from 15 to 30
            
            for (let i = 0; i < spiderCount; i++) {
                const symbol = spiderSymbols[i % spiderSymbols.length];
                const fontSize = symbol === "✮" ? 32 : 28;
                ctx.font = `${fontSize}px Arial`;
                
                let x = 20 + Math.random() * (previewCanvas.width - 40);
                let y = 40 + Math.random() * (canvasHeight - 80);
                
                ctx.fillText(symbol, x, y);
            }
            break;
            
        case "none":
        default:
            break;
    }
}

// Retake Single Photo
function retakeSinglePhoto(index) {
    if (confirm(`Retake foto ke-${index + 1}?`)) {
        currentPhotoIndex = index;
        
        let delay = parseInt(timerInput.value) || 3;
        showCountdown(delay);
        
        setTimeout(async () => {
            await takePhotoAsync();
            capturedPhotos[index] = capturedPhotos[capturedPhotos.length - 1];
            capturedPhotos.pop();
            
            setTimeout(() => {
                showPreview();
            }, 300);
        }, delay * 1000);
    }
}

// Retake All Photos
btnRetake.addEventListener("click", () => {
    if (confirm("Retake semua foto?")) {
        rightSide.classList.remove("active");
        container.classList.remove("has-preview");
        capturedPhotos = [];
        let delay = parseInt(timerInput.value) || 3;
        startSequence(delay);
    }
});

// Save Photo
btnSave.addEventListener("click", () => {
    drawStickersToCanvas();

    let dataURL = previewCanvas.toDataURL("image/png");
    
    // Download to device
    let a = document.createElement("a");
    a.href = dataURL;
    a.download = `E-Photobooth-${Date.now()}.png`;
    a.click();
    
    // Show success message
    alert("Foto berhasil disimpan! 🎉");
    
    // Reset for new photo
    setTimeout(() => {
        rightSide.classList.remove("active");
        container.classList.remove("has-preview");
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        capturedPhotos = [];
        if(stickerLayer) stickerLayer.innerHTML = '';
    }, 500);
});

// Save GIF (Live Photo Export)
btnSaveVideo.addEventListener("click", () => {
    btnSaveVideo.disabled = true;
    btnSaveVideo.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> Merender GIF...</span>';
    
    // Pause animation to stop it interfering
    let wasPaused = isAnimPaused;
    isAnimPaused = true;
    drawStickersToCanvas();

    // Fetch the worker as a Blob to avoid CORS issues
    fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
        .then(response => response.text())
        .then(workerText => {
            const workerBlob = new Blob([workerText], { type: 'application/javascript' });
            const workerUrl = URL.createObjectURL(workerBlob);
            
            // Create scaled down canvas for faster rendering and smaller file size
            const scale = 0.5; // Half size
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = previewCanvas.width * scale;
            tempCanvas.height = previewCanvas.height * scale;
            const tempCtx = tempCanvas.getContext('2d');
            
            const gif = new GIF({
                workers: 2,
                quality: 10,
                width: tempCanvas.width,
                height: tempCanvas.height,
                workerScript: workerUrl
            });

            // The array of captured photos has 10 frames each
            for (let i = 0; i < 10; i++) {
                // Draw the specific frame onto our main previewCanvas
                createStoryGrid(capturedPhotos, i);
                drawStickersToCanvas(); // Ensure stickers are drawn over it
                
                // Copy the result to our scaled-down tempCanvas
                tempCtx.fillStyle = '#fff';
                tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                tempCtx.drawImage(previewCanvas, 0, 0, tempCanvas.width, tempCanvas.height);
                
                // Add frame to GIF
                gif.addFrame(tempCtx, {copy: true, delay: 100}); // 100ms = 10fps
            }
            
            gif.on('finished', function(blob) {
                const gifUrl = URL.createObjectURL(blob);
                let a = document.createElement("a");
                a.href = gifUrl;
                a.download = `E-Photobooth-Live-${Date.now()}.gif`;
                a.click();
                
                alert("Live Photo berhasil disimpan sebagai GIF! 🎬");
                
                btnSaveVideo.disabled = false;
                btnSaveVideo.innerHTML = '<span><i class="fas fa-film"></i> Save GIF (Live)</span>';
                
                // Restore animation state
                isAnimPaused = wasPaused;
            });
            
            gif.render();
        })
        .catch(err => {
            alert("Gagal memuat sistem GIF.");
            btnSaveVideo.disabled = false;
            btnSaveVideo.innerHTML = '<span><i class="fas fa-film"></i> Save GIF (Live)</span>';
            isAnimPaused = wasPaused;
        });
});



// ================= STICKER LOGIC =================
const customStickers = [
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__10_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__11_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__1_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__2_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__3_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__4_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__5_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__6_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__7_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__8_-removebg-preview.png",
    "Pelekat_Maklum_Balas_Digital_Haiwan_Gajah_Merah_Jambu_dan_Biru__9_-removebg-preview.png"
];

function initStickerPicker() {
    if(!stickerList) return;
    stickerList.innerHTML = '';
    customStickers.forEach(filename => {
        let img = document.createElement('img');
        img.src = 'Sticker/' + filename;
        img.className = 'sticker-picker-item';
        img.addEventListener('click', () => addStickerToCanvas(img.src));
        stickerList.appendChild(img);
    });
}

function addStickerToCanvas(src) {
    let sticker = document.createElement('div');
    sticker.className = 'draggable-sticker active';
    sticker.style.left = '50%';
    sticker.style.top = '50%';
    
    // Use dataset for easy access to transform values
    sticker.dataset.x = 0;
    sticker.dataset.y = 0;
    sticker.dataset.scale = 1;
    sticker.dataset.rotation = 0;
    
    updateStickerTransform(sticker);

    let img = document.createElement('img');
    img.src = src;
    
    let delBtn = document.createElement('div');
    delBtn.className = 'sticker-control sticker-delete';
    delBtn.innerHTML = '<i class="fas fa-times"></i>';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sticker.remove();
    });
    
    let resizeBtn = document.createElement('div');
    resizeBtn.className = 'sticker-control sticker-resize';
    resizeBtn.innerHTML = '<i class="fas fa-expand-alt"></i>';
    
    sticker.appendChild(img);
    sticker.appendChild(delBtn);
    sticker.appendChild(resizeBtn);
    
    if (activeSticker) activeSticker.classList.remove('active');
    activeSticker = sticker;
    stickerLayer.appendChild(sticker);
    
    img.onload = () => {
        let maxW = 100; // max initial width
        let ratio = img.naturalWidth / img.naturalHeight;
        sticker.style.width = maxW + 'px';
        sticker.style.height = (maxW / ratio) + 'px';
        sticker.style.marginLeft = -(maxW / 2) + 'px';
        sticker.style.marginTop = -(maxW / ratio / 2) + 'px';
    };

    setupStickerEvents(sticker, resizeBtn);
}

function updateStickerTransform(sticker) {
    let x = parseFloat(sticker.dataset.x) || 0;
    let y = parseFloat(sticker.dataset.y) || 0;
    let scale = parseFloat(sticker.dataset.scale) || 1;
    let rotation = parseFloat(sticker.dataset.rotation) || 0;
    
    sticker.style.transform = `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotation}deg)`;
}

function setupStickerEvents(sticker, resizeBtn) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY;
    let startScale, startRotation;
    let centerX, centerY;
    
    // Activation
    sticker.addEventListener('mousedown', activate);
    sticker.addEventListener('touchstart', activate, {passive: false});
    
    function activate(e) {
        if (e.target.closest('.sticker-delete')) return;
        
        if (activeSticker) activeSticker.classList.remove('active');
        sticker.classList.add('active');
        activeSticker = sticker;
        
        if (e.target.closest('.sticker-resize')) {
            isResizing = true;
            let rect = sticker.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
        } else {
            isDragging = true;
        }
        
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        startY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        startScale = parseFloat(sticker.dataset.scale);
        startRotation = parseFloat(sticker.dataset.rotation);
        
        e.preventDefault();
    }
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
    
    function onMove(e) {
        if (!isDragging && !isResizing) return;
        e.preventDefault();
        
        let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        let clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;
        
        if (isDragging) {
            let dx = clientX - startX;
            let dy = clientY - startY;
            sticker.dataset.x = parseFloat(sticker.dataset.x) + dx;
            sticker.dataset.y = parseFloat(sticker.dataset.y) + dy;
            updateStickerTransform(sticker);
            
            startX = clientX;
            startY = clientY;
        } else if (isResizing) {
            // Distance from center to pointer gives scale
            let distStart = Math.hypot(startX - centerX, startY - centerY);
            let distCurrent = Math.hypot(clientX - centerX, clientY - centerY);
            let newScale = startScale * (distCurrent / distStart);
            
            // Angle from center to pointer gives rotation
            let angleStart = Math.atan2(startY - centerY, startX - centerX);
            let angleCurrent = Math.atan2(clientY - centerY, clientX - centerX);
            let angleDiff = (angleCurrent - angleStart) * (180 / Math.PI);
            let newRotation = startRotation + angleDiff;
            
            sticker.dataset.scale = Math.max(0.2, newScale);
            sticker.dataset.rotation = newRotation;
            updateStickerTransform(sticker);
        }
    }
    
    function onEnd() {
        isDragging = false;
        isResizing = false;
    }
}

// Deselect when clicking outside
document.addEventListener('mousedown', (e) => {
    if (activeSticker && !e.target.closest('.draggable-sticker') && !e.target.closest('.sticker-picker-item')) {
        activeSticker.classList.remove('active');
        activeSticker = null;
    }
});
document.addEventListener('touchstart', (e) => {
    if (activeSticker && !e.target.closest('.draggable-sticker') && !e.target.closest('.sticker-picker-item')) {
        activeSticker.classList.remove('active');
        activeSticker = null;
    }
}, {passive: true});

function drawStickersToCanvas() {
    if (!stickerLayer) return;
    const ctx = previewCanvas.getContext("2d");
    const stickers = stickerLayer.querySelectorAll('.draggable-sticker');
    
    let wrapperRect = canvasWrapper.getBoundingClientRect();
    let scaleX = previewCanvas.width / wrapperRect.width;
    let scaleY = previewCanvas.height / wrapperRect.height;
    
    if (activeSticker) activeSticker.classList.remove('active');
    
    stickers.forEach(sticker => {
        let img = sticker.querySelector('img');
        let xOff = parseFloat(sticker.dataset.x) || 0;
        let yOff = parseFloat(sticker.dataset.y) || 0;
        let sScale = parseFloat(sticker.dataset.scale) || 1;
        let sRot = parseFloat(sticker.dataset.rotation) || 0;
        
        let centerXDOM = (wrapperRect.width / 2) + xOff;
        let centerYDOM = (wrapperRect.height / 2) + yOff;
        
        let canvasX = centerXDOM * scaleX;
        let canvasY = centerYDOM * scaleY;
        
        let baseW = parseFloat(sticker.style.width);
        let baseH = parseFloat(sticker.style.height);
        
        let canvasBaseW = baseW * scaleX;
        let canvasBaseH = baseH * scaleY;
        
        ctx.save();
        ctx.translate(canvasX, canvasY);
        ctx.rotate(sRot * Math.PI / 180);
        ctx.scale(sScale, sScale);
        
        ctx.drawImage(img, -canvasBaseW/2, -canvasBaseH/2, canvasBaseW, canvasBaseH);
        
        ctx.restore();
    });
}

// Prevent accidental page close
window.addEventListener('beforeunload', (e) => {
    if (capturedPhotos.length > 0) {
        e.preventDefault();
        e.returnValue = '';
    }
});
