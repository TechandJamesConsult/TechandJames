// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        // Random properties
        const size = Math.random() * 20 + 5;
        const posX = Math.random() * 100;
        const delay = Math.random() * 15;
        const duration = Math.random() * 10 + 15;

        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${posX}%`;
        particle.style.animationDelay = `${delay}s`;
        particle.style.animationDuration = `${duration}s`;

        particlesContainer.appendChild(particle);
    }
}

// Header scroll effect
window.addEventListener('scroll', function() {
    const header = document.getElementById('header');
    if (window.scrollY > 100) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// Mobile menu toggle
const mobileToggle = document.getElementById('mobileToggle');
const nav = document.getElementById('nav');
let autoHideTimeout;
let isMouseOverNav = false;

function closeMenu() {
    nav.classList.remove('active');
    // Reset icon to bars
    const icon = mobileToggle.querySelector('i');
    if (icon) {
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    }
    // Clear any existing timeout
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
    }
}

function startAutoHideTimer() {
    // Clear any existing timeout
    if (autoHideTimeout) {
        clearTimeout(autoHideTimeout);
    }
    
    // Only set timeout if menu is open and mouse is not over it
    if (nav.classList.contains('active') && !isMouseOverNav) {
        autoHideTimeout = setTimeout(() => {
            if (!isMouseOverNav) { // Double check before closing
                closeMenu();
            }
        }, 3000); // Reduced to 3 seconds for better responsiveness
    }
}

function resetAutoHideTimer() {
    if (nav.classList.contains('active')) {
        startAutoHideTimer();
    }
}

function toggleMenu() {
    const isOpening = !nav.classList.contains('active');
    
    if (isOpening) {
        nav.classList.add('active');
        // Start auto-hide when opening menu
        startAutoHideTimer();
    } else {
        closeMenu();
    }
    
    // Toggle icon
    const icon = mobileToggle.querySelector('i');
    if (icon) {
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-times');
    }
}

mobileToggle.addEventListener('click', toggleMenu);

// Close menu when clicking any link in the sidebar
nav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
});

// Mouse enter/leave for nav
nav.addEventListener('mouseenter', () => {
    isMouseOverNav = true;
    if (autoHideTimeout) clearTimeout(autoHideTimeout);
});

nav.addEventListener('mouseleave', () => {
    isMouseOverNav = false;
    startAutoHideTimer();
});

// Touch events for mobile - better handling
let lastTouchTime = 0;
const debounceTime = 300; // ms

document.addEventListener('touchstart', (e) => {
    const currentTime = new Date().getTime();
    const timeSinceLastTouch = currentTime - lastTouchTime;
    
    // If user taps outside the nav, close it
    if (!nav.contains(e.target) && !mobileToggle.contains(e.target)) {
        if (timeSinceLastTouch > debounceTime) {
            closeMenu();
        }
    }
    
    lastTouchTime = currentTime;
    
    // Reset auto-hide timer on any touch
    if (nav.classList.contains('active')) {
        startAutoHideTimer();
    }
});

// Click outside to close
document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && !mobileToggle.contains(e.target)) {
        closeMenu();
    }
});

// Update Logo Text from "And" to "&"
const logos = document.querySelectorAll('.logo');
logos.forEach(logo => {
    if (logo) {
        // Use a text node search to avoid reloading the image (innerHTML replacement recreates elements)
        const walker = document.createTreeWalker(logo, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while(node = walker.nextNode()) {
            if (node.nodeValue.includes('Tech And James Consult')) {
                node.nodeValue = node.nodeValue.replace('Tech And James Consult', 'Tech & James Consult');
            }
        }
    }
});

// Also update document title if needed
if (document.title.includes('Tech And James Consult')) {
    document.title = document.title.replace('Tech And James Consult', 'Tech & James Consult');
}

// Initialize particles on load
window.addEventListener('load', function() {
    createParticles();
});

// Add scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe service cards
document.querySelectorAll('.service-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
});

// Observe about section
document.querySelectorAll('.about-content > div').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
    observer.observe(el);
});
// Add floating card interaction
document.querySelectorAll('.floating-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.animationPlayState = 'paused';
    });

    card.addEventListener('mouseleave', function() {
        this.style.animationPlayState = 'running';
    });
});

// Add random pulse animation to some elements
document.querySelectorAll('.service-icon').forEach((icon, index) => {
    if (index % 2 === 0) {
        icon.classList.add('pulse');
    } else {
        icon.classList.add('bounce');
    }
});
