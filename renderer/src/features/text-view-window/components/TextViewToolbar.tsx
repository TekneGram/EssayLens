interface TextViewToolbarProps {
  zoomPercent: number;
  minZoomPercent: number;
  maxZoomPercent: number;
  stepPercent: number;
  defaultZoomPercent: number;
  canControlZoom: boolean;
  onZoomChange: (value: number) => void;
  onResetZoom: () => void;
}

export function TextViewToolbar({
  zoomPercent,
  minZoomPercent,
  maxZoomPercent,
  stepPercent,
  defaultZoomPercent,
  canControlZoom,
  onZoomChange,
  onResetZoom
}: TextViewToolbarProps) {
  return (
    <div className="text-view-zoom-controls" role="group" aria-label="Document zoom controls">
      <label className="text-view-zoom-label" htmlFor="docx-zoom-slider">
        Zoom: {zoomPercent}%
      </label>
      <input
        id="docx-zoom-slider"
        className="text-view-zoom-slider"
        type="range"
        min={minZoomPercent}
        max={maxZoomPercent}
        step={stepPercent}
        value={zoomPercent}
        onChange={(event) => onZoomChange(Number(event.target.value))}
        disabled={!canControlZoom}
        aria-label="Document zoom"
      />
      <button
        type="button"
        className="text-view-zoom-button text-view-zoom-reset"
        onClick={onResetZoom}
        disabled={!canControlZoom || zoomPercent === defaultZoomPercent}
      >
        Reset
      </button>
    </div>
  );
}
