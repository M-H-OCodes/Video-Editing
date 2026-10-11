
document.addEventListener("DOMContentLoaded", function() {
    
    
    const elementsToAnimate = document.querySelectorAll('.animate-on-scroll');


    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
               
                entry.target.classList.add('visible');
            } else {
                
                entry.target.classList.remove('visible');
            }
        });
    }, { threshold: 0.1 });


    elementsToAnimate.forEach(element => {
        observer.observe(element);
    });
});