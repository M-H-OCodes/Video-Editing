let index = 0;

function moveCarousel(step) {
    const carousel = document.querySelector('.carousel');
    const items = document.querySelectorAll('.video-item');
    const totalItems = items.length;

    index += step;

    if (index < 0) {
        index = totalItems - 2; 
        carousel.style.transition = 'none'; 
    } else if (index >= totalItems - 1) {
        index = 0; 
        carousel.style.transition = 'none'; 
    } else {
        carousel.style.transition = 'transform 0.4s ease-in-out'; 
    }

    carousel.style.transform = `translateX(${-index * 50}%)`;

    setTimeout(() => {
        carousel.style.transition = 'transform 0.4s ease-in-out';
    }, 50);
}

let index2 = 0;

function moveCarousel2(step) {
    const carousel = document.querySelector('.carousel2');
    const items = document.querySelectorAll('.video-item2');
    const totalItems = items.length;

    index2 += step;

    if (index2 < 0) {
        index2 = totalItems - 2; 
        carousel.style.transition = 'none'; 
    } else if (index2 >= totalItems - 1) {
        index2 = 0; 
        carousel.style.transition = 'none'; 
    } else {
        carousel.style.transition = 'transform 0.4s ease-in-out'; 
    }

    carousel.style.transform = `translateX(${-index2 * 50}%)`;

    setTimeout(() => {
        carousel.style.transition = 'transform 0.4s ease-in-out';
    }, 50);
}

let index3 = 0; 

function moveCarousel3(step) {
    const carousel = document.querySelector('.carousel3');
    const items = document.querySelectorAll('.video-item3');
    const totalItems = items.length;

    index3 += step;

    if (index3 < 0) {
        index3 = totalItems - 1;
    } else if (index3 >= totalItems) {
        index3 = 0;
    }

    const itemWidth = items[0].clientWidth;
    const translateX = -index3 * itemWidth;

    carousel.style.transform = `translateX(${translateX}px)`;
}