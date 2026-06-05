import { getDefaultAccentColor } from "@/lib/template-config";

export function ResumeSkeleton({
  templateId,
}: {
  templateId: string | null | undefined;
}) {
  const accentColor = getDefaultAccentColor(templateId);
  const isTwoColumn = templateId === "two-column";

  // Create a custom shimmer gradient style incorporating the dynamic accent color
  const shimmerStyle = {
    background: `linear-gradient(90deg, #f1f5f9 25%, ${accentColor}25 50%, #f1f5f9 75%)`,
    backgroundSize: "200% 100%",
  };

  const grayShimmerStyle = {
    background: `linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)`,
    backgroundSize: "200% 100%",
  };

  const darkGrayShimmerStyle = {
    background: `linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%)`,
    backgroundSize: "200% 100%",
  };

  return (
    <div className="w-[820px] min-h-[1160px] bg-white p-12 flex flex-col justify-start select-none">
      {isTwoColumn ? (
        // Two-Column Template Skeleton
        <div className="flex gap-10 w-full h-full flex-1">
          {/* Sidebar */}
          <div className="w-[240px] flex flex-col gap-6 border-r border-slate-100 pr-6 shrink-0">
            {/* Avatar Circle Placeholder */}
            <div
              className="w-24 h-24 rounded-full skeleton-shimmer mx-auto mb-4"
              style={shimmerStyle}
            />
            {/* Contact Details */}
            <div className="flex flex-col gap-3">
              <div className="w-16 h-3 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
              <div className="w-full h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-[90%] h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-[80%] h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
            </div>
            {/* Skills Details */}
            <div className="flex flex-col gap-3 mt-4">
              <div className="w-20 h-4 rounded skeleton-shimmer" style={shimmerStyle} />
              <div className="flex flex-wrap gap-2">
                <div className="w-16 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-20 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-14 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-18 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
              </div>
            </div>
            {/* Languages */}
            <div className="flex flex-col gap-3 mt-4">
              <div className="w-24 h-4 rounded skeleton-shimmer" style={shimmerStyle} />
              <div className="w-[70%] h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-[60%] h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Name and Title */}
            <div className="flex flex-col gap-2.5">
              <div className="w-64 h-8 rounded skeleton-shimmer" style={shimmerStyle} />
              <div className="w-40 h-4 rounded skeleton-shimmer" style={grayShimmerStyle} />
            </div>

            {/* Profile Summary */}
            <div className="flex flex-col gap-2.5">
              <div className="w-28 h-4 rounded skeleton-shimmer" style={shimmerStyle} />
              <div className="w-full h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-full h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-[85%] h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
            </div>

            {/* Experience Section */}
            <div className="flex flex-col gap-4 mt-2">
              <div className="w-32 h-4.5 rounded skeleton-shimmer" style={shimmerStyle} />
              {/* Job 1 */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between w-full">
                  <div className="w-48 h-3.5 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
                  <div className="w-20 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
                </div>
                <div className="w-36 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="flex flex-col gap-1.5 pl-4 mt-1">
                  <div className="w-full h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                  <div className="w-[95%] h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                  <div className="w-[80%] h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                </div>
              </div>
              {/* Job 2 */}
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between w-full">
                  <div className="w-40 h-3.5 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
                  <div className="w-20 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
                </div>
                <div className="w-32 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="flex flex-col gap-1.5 pl-4 mt-1">
                  <div className="w-full h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                  <div className="w-[90%] h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                </div>
              </div>
            </div>

            {/* Education Section */}
            <div className="flex flex-col gap-4 mt-2">
              <div className="w-28 h-4.5 rounded skeleton-shimmer" style={shimmerStyle} />
              <div className="flex justify-between w-full">
                <div className="w-56 h-3.5 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
                <div className="w-20 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Single-Column Template Skeleton (Standard layouts)
        <div className="flex flex-col gap-8 w-full h-full flex-1">
          {/* Header */}
          <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-6">
            <div className="w-72 h-8 rounded skeleton-shimmer" style={shimmerStyle} />
            <div className="w-48 h-4 rounded skeleton-shimmer" style={grayShimmerStyle} />
            <div className="flex justify-center gap-4 mt-2">
              <div className="w-24 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-28 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-20 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
            </div>
          </div>

          {/* Profile Summary */}
          <div className="flex flex-col gap-2.5">
            <div className="w-36 h-4.5 rounded skeleton-shimmer" style={shimmerStyle} />
            <div className="w-full h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
            <div className="w-full h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
            <div className="w-[92%] h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
          </div>

          {/* Work Experience */}
          <div className="flex flex-col gap-5 mt-2">
            <div className="w-40 h-4.5 rounded skeleton-shimmer" style={shimmerStyle} />
            {/* Job 1 */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between w-full">
                <div className="w-56 h-3.5 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
                <div className="w-24 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
              <div className="flex justify-between w-full">
                <div className="w-40 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-16 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
              <div className="flex flex-col gap-1.5 pl-4 mt-1">
                <div className="w-full h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-[96%] h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-[85%] h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
            </div>
            {/* Job 2 */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between w-full">
                <div className="w-48 h-3.5 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
                <div className="w-24 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
              <div className="flex justify-between w-full">
                <div className="w-36 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-16 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
              <div className="flex flex-col gap-1.5 pl-4 mt-1">
                <div className="w-full h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
                <div className="w-[90%] h-2 rounded skeleton-shimmer" style={grayShimmerStyle} />
              </div>
            </div>
          </div>

          {/* Education */}
          <div className="flex flex-col gap-3 mt-2">
            <div className="w-32 h-4.5 rounded skeleton-shimmer" style={shimmerStyle} />
            <div className="flex justify-between w-full">
              <div className="w-64 h-3.5 rounded skeleton-shimmer" style={darkGrayShimmerStyle} />
              <div className="w-24 h-3 rounded skeleton-shimmer" style={grayShimmerStyle} />
            </div>
            <div className="w-40 h-2.5 rounded skeleton-shimmer" style={grayShimmerStyle} />
          </div>

          {/* Skills */}
          <div className="flex flex-col gap-3 mt-2">
            <div className="w-28 h-4.5 rounded skeleton-shimmer" style={shimmerStyle} />
            <div className="flex flex-wrap gap-2">
              <div className="w-16 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-20 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-14 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-24 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-18 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
              <div className="w-22 h-5 rounded-full skeleton-shimmer" style={grayShimmerStyle} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
