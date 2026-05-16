import { Slider } from "@/components/ui/slider";
import {
  FONT_SCALE_STEPS,
  fontScaleToSliderIndex,
  formatFontScaleLabel,
  sliderIndexToFontScale,
  snapFontScale,
} from "@/lib/resume-font-scale";

type FontSizeSliderProps = {
  value: number;
  onChange: (scale: number) => void;
  className?: string;
};

export function FontSizeSlider({ value, onChange, className }: FontSizeSliderProps) {
  const snapped = snapFontScale(value);
  const index = fontScaleToSliderIndex(snapped);

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-foreground tabular-nums">
          {formatFontScaleLabel(snapped)}
        </span>
        <span className="text-[10px] text-muted-foreground">100% – 150%</span>
      </div>
      <Slider
        min={0}
        max={FONT_SCALE_STEPS.length - 1}
        step={1}
        value={[index]}
        onValueChange={([idx]) => onChange(sliderIndexToFontScale(idx ?? 0))}
        aria-label="Font size"
        aria-valuemin={0}
        aria-valuemax={FONT_SCALE_STEPS.length - 1}
        aria-valuenow={index}
        aria-valuetext={formatFontScaleLabel(snapped)}
        className="touch-manipulation"
      />
      <div className="mt-1.5 flex justify-between px-0.5">
        {FONT_SCALE_STEPS.map((step) => (
          <span
            key={step}
            className={`text-[9px] tabular-nums ${
              Math.abs(step - snapped) < 0.001 ? "font-semibold text-foreground" : "text-muted-foreground/70"
            }`}
          >
            {Math.round(step * 100)}
          </span>
        ))}
      </div>
    </div>
  );
}
