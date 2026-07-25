// src/components/ui/Logo.jsx
export const Logo = ({ className }) => {
  return (
    <svg
      id="Layer_1"
      data-name="Layer 1"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 458.47 321.05"
      className={className}
      fill="currentColor"
    >
      <defs>
        <style>
          {`
            .cls-1 {
              fill: currentColor;
              stroke-width: 0px;
            }
          `}
        </style>
      </defs>
      <polygon
        className="cls-1"
        points="256.99 0 0 321.05 64.03 321.05 321.03 0 256.99 0"
      />
      <polygon
        className="cls-1"
        points="394.44 321.05 458.47 321.05 329.96 160.5 458.44 0 394.41 0 297.94 120.51 265.93 160.5 137.41 321.05 160.51 321.05 201.44 321.05 295.46 321.05 330.28 278.26 235.69 278.26 297.94 200.5 394.44 321.05"
      />
    </svg>
  );
};
