// src/components/ui/Logo.jsx
export const Logo = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 339.63 339.63"
      className={className}
      fill="currentColor" // Ini rahasianya! Logo akan mengikuti warna teks
    >
      <g>
        <polygon points="271.89 339.63 339.63 339.63 203.67 169.79 339.59 0 271.86 0 169.81 127.49 142.01 92.77 108.15 135.07 135.94 169.79 0 339.61 67.73 339.61 68.39 338.79 167.19 338.79 204.03 293.53 104.62 293.53 169.81 212.1 271.89 339.63" />
      </g>
    </svg>
  );
};
