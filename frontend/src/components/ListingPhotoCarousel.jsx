import React, { useEffect, useMemo, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

function normalizeImages(images) {
  if (Array.isArray(images)) return images.filter((image) => typeof image === 'string' && image.trim()).map((image) => image.trim());
  if (typeof images === 'string' && images.trim()) return images.split(/\|\||,/).map((image) => image.trim()).filter(Boolean);
  return [];
}

export default function ListingPhotoCarousel({ images, name, className = '', alt = 'Property photo' }) {
  const photos = useMemo(() => normalizeImages(images), [images]);
  const [activeIndex, setActiveIndex] = useState(() => Math.floor(Math.random() * Math.max(1, photos.length)));

  useEffect(() => {
    if (photos.length < 2 || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    let timer;
    const scheduleNext = () => {
      timer = window.setTimeout(() => {
        setActiveIndex((current) => {
          const offset = 1 + Math.floor(Math.random() * (photos.length - 1));
          return (current + offset) % photos.length;
        });
        scheduleNext();
      }, 3500 + Math.floor(Math.random() * 3000));
    };
    scheduleNext();
    return () => window.clearTimeout(timer);
  }, [photos.length]);

  const changePhoto = (direction) => setActiveIndex((current) => (current + direction + photos.length) % photos.length);

  if (!photos.length) return <span className="browse-no-image">No property image</span>;

  return (
    <>
      <img key={photos[activeIndex]} src={photos[activeIndex]} alt={`${name || alt} photo ${activeIndex + 1}`} onError={(event) => { event.currentTarget.hidden = true; }} className={className} />
      {photos.length > 1 && <>
        <span className="listing-photo-count" aria-live="polite">{activeIndex + 1} / {photos.length}</span>
        <button type="button" className="listing-photo-arrow listing-photo-previous" aria-label="Previous property photo" onClick={(event) => { event.preventDefault(); event.stopPropagation(); changePhoto(-1); }}><FaChevronLeft /></button>
        <button type="button" className="listing-photo-arrow listing-photo-next" aria-label="Next property photo" onClick={(event) => { event.preventDefault(); event.stopPropagation(); changePhoto(1); }}><FaChevronRight /></button>
      </>}
    </>
  );
}
