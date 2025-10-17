import React from "react";

const LoadingScreen = () => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="logo-container">
          <div className="jellyfish-logo">
            <svg
              width="200"
              height="200"
              viewBox="0 0 400 400"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Jellyfish Bell */}
              <ellipse
                cx="200"
                cy="150"
                rx="80"
                ry="60"
                fill="#1a5f5f"
                className="jellyfish-bell"
              />

              {/* Inner pattern */}
              <ellipse
                cx="200"
                cy="140"
                rx="60"
                ry="45"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                opacity="0.7"
              />
              <ellipse
                cx="200"
                cy="130"
                rx="40"
                ry="30"
                fill="none"
                stroke="#ffffff"
                strokeWidth="2"
                opacity="0.5"
              />

              {/* Tentacles */}
              <g className="tentacles">
                <path
                  d="M160 200 Q155 230 165 260 Q170 290 160 320"
                  stroke="#1a5f5f"
                  strokeWidth="8"
                  fill="none"
                  className="tentacle tentacle-1"
                />
                <path
                  d="M180 210 Q175 240 185 270 Q190 300 180 330"
                  stroke="#1a5f5f"
                  strokeWidth="6"
                  fill="none"
                  className="tentacle tentacle-2"
                />
                <path
                  d="M200 215 Q195 245 205 275 Q210 305 200 335"
                  stroke="#1a5f5f"
                  strokeWidth="8"
                  fill="none"
                  className="tentacle tentacle-3"
                />
                <path
                  d="M220 210 Q225 240 215 270 Q210 300 220 330"
                  stroke="#1a5f5f"
                  strokeWidth="6"
                  fill="none"
                  className="tentacle tentacle-4"
                />
                <path
                  d="M240 200 Q245 230 235 260 Q230 290 240 320"
                  stroke="#1a5f5f"
                  strokeWidth="8"
                  fill="none"
                  className="tentacle tentacle-5"
                />
              </g>

              {/* Dots around */}
              <circle
                cx="120"
                cy="280"
                r="4"
                fill="#d4af37"
                className="dot dot-1"
              />
              <circle
                cx="140"
                cy="300"
                r="3"
                fill="#d4af37"
                className="dot dot-2"
              />
              <circle
                cx="260"
                cy="300"
                r="3"
                fill="#d4af37"
                className="dot dot-3"
              />
              <circle
                cx="280"
                cy="280"
                r="4"
                fill="#d4af37"
                className="dot dot-4"
              />
            </svg>
          </div>
        </div>

        <div className="brand-text">
          <span className="jelly">Jel</span>
          <span className="ly">ly</span>
          <span className="fish">fish</span>
        </div>

        <div className="loading-spinner">
          <div className="wave wave-1"></div>
          <div className="wave wave-2"></div>
          <div className="wave wave-3"></div>
        </div>
      </div>

      <style jsx>{`
        .loading-screen {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          background: linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.3s ease-in;
        }

        .loading-content {
          text-align: center;
          animation: float 3s ease-in-out infinite;
        }

        .logo-container {
          margin-bottom: 2rem;
        }

        .jellyfish-bell {
          animation: pulse 2s ease-in-out infinite;
          transform-origin: center;
        }

        .tentacles {
          animation: sway 3s ease-in-out infinite;
          transform-origin: center top;
        }

        .tentacle-1 {
          animation: sway 3s ease-in-out infinite 0s;
        }
        .tentacle-2 {
          animation: sway 3s ease-in-out infinite 0.2s;
        }
        .tentacle-3 {
          animation: sway 3s ease-in-out infinite 0.4s;
        }
        .tentacle-4 {
          animation: sway 3s ease-in-out infinite 0.6s;
        }
        .tentacle-5 {
          animation: sway 3s ease-in-out infinite 0.8s;
        }

        .dot {
          animation: sparkle 2s ease-in-out infinite;
        }

        .dot-1 {
          animation-delay: 0s;
        }
        .dot-2 {
          animation-delay: 0.5s;
        }
        .dot-3 {
          animation-delay: 1s;
        }
        .dot-4 {
          animation-delay: 1.5s;
        }

        .brand-text {
          font-size: 3rem;
          font-weight: bold;
          margin: 1.5rem 0;
          letter-spacing: 2px;
        }

        .jelly {
          color: #d4af37;
          animation: colorShift 2s ease-in-out infinite;
        }

        .ly {
          color: #1a5f5f;
        }

        .fish {
          color: #1a5f5f;
          position: relative;
        }

        .fish::after {
          content: "";
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 2px;
          background: #1a5f5f;
          animation: underlineGrow 2s ease-in-out infinite;
        }

        .loading-spinner {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 2rem;
        }

        .wave {
          width: 12px;
          height: 12px;
          background: #1a5f5f;
          border-radius: 50%;
          animation: wave 1.5s ease-in-out infinite;
        }

        .wave-1 {
          animation-delay: 0s;
        }
        .wave-2 {
          animation-delay: 0.2s;
        }
        .wave-3 {
          animation-delay: 0.4s;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse {
          0%,
          100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes sway {
          0%,
          100% {
            transform: rotate(0deg);
          }
          33% {
            transform: rotate(2deg);
          }
          66% {
            transform: rotate(-2deg);
          }
        }

        @keyframes sparkle {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.3);
          }
        }

        @keyframes colorShift {
          0%,
          100% {
            color: #d4af37;
          }
          50% {
            color: #1a5f5f;
          }
        }

        @keyframes underlineGrow {
          0%,
          100% {
            width: 0;
          }
          50% {
            width: 100%;
          }
        }

        @keyframes wave {
          0%,
          100% {
            transform: translateY(0px);
            opacity: 0.7;
          }
          50% {
            transform: translateY(-15px);
            opacity: 1;
          }
        }

        @media (max-width: 768px) {
          .jellyfish-logo svg {
            width: 150px;
            height: 150px;
          }

          .brand-text {
            font-size: 2rem;
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
