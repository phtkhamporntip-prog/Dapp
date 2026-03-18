export default function BrandLogo ( { className = '', alt = 'OnchainWeb' } ) {
    return (
        <svg
            viewBox="0 0 128 128"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={alt}
            className={className}
        >
            <defs>
                <linearGradient id="brandLogoGradient" x1="20" y1="14" x2="108" y2="114" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#0A2A66" />
                    <stop offset="0.55" stopColor="#0E6DFF" />
                    <stop offset="1" stopColor="#1DD3FF" />
                </linearGradient>
            </defs>
            <path d="M64 8L106.435 32.5V81.5L64 106L21.5654 81.5V32.5L64 8Z" fill="url(#brandLogoGradient)" />
            <path d="M64 20L95.6122 38.25V74.75L64 93L32.3878 74.75V38.25L64 20Z" fill="#0A1328" fillOpacity="0.18" />
            <path d="M81.5 37.5C77.9 31.7 71.6 28 63.4 28C52.8 28 44.8 34.3 44.8 43.3C44.8 50.1 49.6 54.3 60 56.9L67.6 58.9C73.5 60.4 75.8 62.4 75.8 65.6C75.8 69.9 71.3 73 64.4 73C56.8 73 51.2 69.6 47.6 63.2L35 70.5C40.2 80.2 50.5 86 63.8 86C78.3 86 89.3 78.3 89.3 65.5C89.3 56.5 83.5 50.7 71 47.7L63.4 45.8C57.5 44.4 55.1 42.6 55.1 39.8C55.1 36.1 58.7 33.4 64.6 33.4C70.1 33.4 74.3 35.8 77 40.5L81.5 37.5Z" fill="white" />
            <path d="M46.5 90.5H81.5" stroke="white" strokeOpacity="0.55" strokeWidth="6" strokeLinecap="round" />
        </svg>
    );
}