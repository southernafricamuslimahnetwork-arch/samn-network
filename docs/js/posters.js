(() => {
  // Featured poster slideshow and accessible click-to-enlarge gallery.
  const posters = [
    { title: "Marriage & Family Issues", src: "assets/marriage-family-issues.jpeg", alt: "Marriage & Family Issues event poster" },
    { title: "Marriage & Mental Well-Being", src: "assets/marriage-mental-wellbeing.jpeg", alt: "Marriage & Mental Well-Being event poster" },
    { title: "Nikah and Civil Marriage", src: "assets/nikah-and-civil-marriage.jpeg", alt: "Nikah and Civil Marriage event poster" },
    { title: "Raising Muslim Children in Interfaith Families", src: "assets/raising-muslim-children-interfaith-families.jpeg", alt: "Raising Muslim Children in Interfaith Families event poster" },
    { title: "SAMN Omnibus: Marriage, Faith & Family", src: "assets/samn-omnibus-marriage-faith-family.jpeg", alt: "SAMN Omnibus: Marriage, Faith & Family event poster" },    { title: "4th Annual SAMN Conference 2026", src: "samn-conference-2026.jpg", alt: "4th Annual SAMN Conference 2026 poster: Fellowship and Empowerment, 10-13 December 2026, Windhoek, Namibia" }
  ];
  const featuredImage = document.getElementById("featured-image");
  const featuredTitle = document.getElementById("featured-title");
  const slideCount = document.getElementById("slide-count");
  const previous = document.getElementById("slide-prev");
  const next = document.getElementById("slide-next");
  const lightbox = document.getElementById("poster-lightbox");
  let lastOpener = null;
  const lightboxImage = document.getElementById("lightbox-image");
  const lightboxTitle = document.getElementById("lightbox-title");
  const lightboxClose = document.getElementById("lightbox-close");
  let activePoster = 0;
  let slideshowTimer = null;

  function showPoster(index) {
    activePoster = (index + posters.length) % posters.length;
    const poster = posters[activePoster];
    if (featuredImage) {
      featuredImage.src = poster.src;
      featuredImage.alt = poster.alt;
    }
    if (featuredTitle) featuredTitle.textContent = poster.title;
    if (slideCount) slideCount.textContent = `${activePoster + 1} / ${posters.length}`;
  }
  function openPoster(index) {
    const poster = posters[index];
    if (!poster || !lightbox || !lightboxImage) return;
    lightboxImage.src = poster.src;
    lightboxImage.alt = `Enlarged ${poster.alt}`;
    if (lightboxTitle) lightboxTitle.textContent = poster.title;
    if (typeof lightbox.showModal === "function") lightbox.showModal();
  }
  function stopSlideshow() {
    if (slideshowTimer) window.clearInterval(slideshowTimer);
    slideshowTimer = null;
  }
  function startSlideshow() {
    stopSlideshow();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      slideshowTimer = window.setInterval(() => showPoster(activePoster + 1), 6000);
    }
  }

  if (featuredImage) {
    document.querySelectorAll(".poster-open").forEach((button) => {
      button.addEventListener("click", () => { lastOpener = button; openPoster(Number(button.dataset.poster)); });
    });
    previous?.addEventListener("click", () => { showPoster(activePoster - 1); startSlideshow(); });
    next?.addEventListener("click", () => { showPoster(activePoster + 1); startSlideshow(); });
    const frame = document.getElementById("featured-frame");
    frame?.addEventListener("mouseenter", stopSlideshow);
    frame?.addEventListener("mouseleave", startSlideshow);
    frame?.addEventListener("focusin", stopSlideshow);
    frame?.addEventListener("focusout", startSlideshow);
    lightboxClose?.addEventListener("click", () => lightbox.close());
    lightbox?.addEventListener("click", (event) => {
      if (event.target === lightbox) lightbox.close();
    });
    lightbox?.addEventListener("close", () => {
      lastOpener?.focus();
    });
    showPoster(0);
    startSlideshow();
  }
})();
