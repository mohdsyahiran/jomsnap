<?php
session_start();

$upload_dir = 'uploads/';
$photos = [];

if (is_dir($upload_dir)) {
    $files = glob($upload_dir . '*.{jpg,jpeg,png,gif,webp}', GLOB_BRACE);
    rsort($files);
    $photos = $files;
}

// Handle photo deletion
if (isset($_GET['delete']) && isset($_GET['photo'])) {
    $photo_to_delete = basename($_GET['photo']);
    $file_path = $upload_dir . $photo_to_delete;
    
    if (file_exists($file_path)) {
        unlink($file_path);
        header('Location: gallery.php');
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gallery - JomSnap Photobooth Services</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
</head>
<body>
    <header>
        <div class="container">
            <nav>
                <a href="index.php" class="logo">
                    <img src="logo.png" alt="JomSnap logo" class="logo-image">
                </a>
                <div class="nav-links">
                    <a href="index.php">Home</a>
                    <a href="index.php#services">Services</a>
                    <a href="index.php#packages">Packages</a>
                    <a href="gallery.php">Gallery</a>
                    <a href="index.php#contact">Contact</a>
                </div>
                <button class="mobile-toggle">☰</button>
            </nav>
        </div>
    </header>

    <main>
        <section class="gallery-section">
            <div class="container">
                <div class="section-header">
                    <h2>Our Portfolio</h2>
                    <div class="section-divider"></div>
                    <p class="section-subtitle">Previous events, setup images and sample print layouts</p>
                </div>
                
                <?php if (isset($_SESSION['last_photo'])): ?>
                    <div class="alert">Photo uploaded successfully!</div>
                    <?php unset($_SESSION['last_photo']); ?>
                <?php endif; ?>

                <?php if (count($photos) === 0): ?>
                    <div class="empty">
                        <p>No photos yet. Start by taking or uploading your first photo!</p>
                        <a href="index.php" class="btn">Take Photo</a>
                    </div>
                <?php else: ?>
                    <p class="count">Total: <?php echo count($photos); ?> photos</p>
                    
                    <div class="photo-grid">
                        <?php foreach ($photos as $index => $photo): ?>
                            <div class="photo-item">
                                <img src="<?php echo htmlspecialchars($photo); ?>" alt="Photo" onclick="openPhoto(<?php echo $index; ?>)">
                                <div class="photo-actions">
                                    <a href="<?php echo htmlspecialchars($photo); ?>" download>Download</a>
                                    <button onclick="deletePhoto('<?php echo basename($photo); ?>')">Delete</button>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </div>
        </section>
    </main>

    <footer class="site-footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo">
                    <img src="logo.png" alt="JomSnap logo" class="logo-image">
                </div>
                <p class="footer-copy">JomSnap (KT0620473-X) &nbsp;·&nbsp; &copy; 2026. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <!-- Lightbox -->
    <div class="lightbox" id="lightbox">
        <button class="close" onclick="closeLightbox()">&times;</button>
        <button class="nav-btn prev" onclick="navigate(-1)">‹</button>
        <button class="nav-btn next" onclick="navigate(1)">›</button>
        <img id="lightbox-img" src="" alt="Photo">
    </div>

    <script>
        const mobileToggle = document.querySelector('.mobile-toggle');
        const navLinks = document.querySelector('.nav-links');
        
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });

        const photos = <?php echo json_encode($photos); ?>;
        let currentIndex = 0;

        function openPhoto(index) {
            currentIndex = index;
            document.getElementById('lightbox').classList.add('active');
            document.getElementById('lightbox-img').src = photos[currentIndex];
            document.body.style.overflow = 'hidden';
        }

        function closeLightbox() {
            document.getElementById('lightbox').classList.remove('active');
            document.body.style.overflow = 'auto';
        }

        function navigate(dir) {
            currentIndex += dir;
            if (currentIndex < 0) currentIndex = photos.length - 1;
            if (currentIndex >= photos.length) currentIndex = 0;
            document.getElementById('lightbox-img').src = photos[currentIndex];
        }

        document.addEventListener('keydown', (e) => {
            const lightbox = document.getElementById('lightbox');
            if (lightbox.classList.contains('active')) {
                if (e.key === 'Escape') closeLightbox();
                if (e.key === 'ArrowLeft') navigate(-1);
                if (e.key === 'ArrowRight') navigate(1);
            }
        });

        function deletePhoto(filename) {
            if (confirm('Delete this photo?')) {
                window.location.href = 'gallery.php?delete=1&photo=' + encodeURIComponent(filename);
            }
        }
    </script>
</body>
</html>