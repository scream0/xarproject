import { useSwiperSlide } from "swiper/react";
import sliderStyles from "./ProductSlider.module.css";

function SlideWrapper({ children }) {
  const swiperSlide = useSwiperSlide();

  return (
    <div
      className={`${sliderStyles.swiperSlide} ${swiperSlide.isActive ? sliderStyles.swiperSlideActive : ""}`}
    >
      {children}
    </div>
  );
}
