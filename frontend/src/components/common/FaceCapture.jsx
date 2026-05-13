import { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { FiCamera, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';

const videoConstraints = {
  width: 480,
  height: 480,
  facingMode: 'user',
};

/**
 * FaceCapture component
 * Props:
 * onCapture(blob) - called when user captures
 * label - button label
 */
const FaceCapture = ({ onCapture, label = 'Capture Face', disabled = false }) => {
  const webcamRef = useRef(null);
  const [captured, setCaptured] = useState(null);
  const [permError, setPermError] = useState(false);

  const captureNow = useCallback(() => {
    if (disabled) return;
    const imgSrc = webcamRef.current?.getScreenshot();
    if (!imgSrc) return;
    setCaptured(imgSrc);

    // Robust base64 to blob conversion
    try {
      const byteString = atob(imgSrc.split(',')[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: 'image/jpeg' });
      onCapture(blob, imgSrc);
    } catch (e) {
      console.error('Failed to convert image', e);
    }
  }, [onCapture, disabled]);

  const retake = () => {
    setCaptured(null);
    onCapture(null, null);
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full relative z-0">
      {/* Camera/Image Container */}
      <div className="relative rounded-3xl overflow-hidden border border-white/10 w-full max-w-sm aspect-square bg-[#0d1321] shadow-[0_0_30px_rgba(0,0,0,0.5)] group">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          onUserMediaError={() => setPermError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${captured ? 'invisible opacity-0 absolute' : 'visible opacity-100 relative'}`}
          mirrored
        />
        
        {!captured && (
          <>
            {/* Face guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[60%] h-[60%] max-w-[240px] max-h-[240px] rounded-full border-2 border-[#f26644]/40 border-dashed shadow-[0_0_20px_rgba(242,102,68,0.15)]" />
            </div>
            {/* Instruction overlay */}
            <div className="absolute bottom-5 left-0 right-0 flex justify-center pointer-events-none z-10">
              <div className="bg-[#1d2d44]/80 backdrop-blur-md border border-white/10 text-white px-5 py-2.5 rounded-2xl text-[11px] uppercase tracking-wider font-bold mx-4 text-center shadow-xl">
                👀 Keep eyes open & look at camera
              </div>
            </div>
          </>
        )}
        
        {captured && (
          <div className="absolute inset-0 w-full h-full">
            <img src={captured} alt="Captured" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-emerald-500/10 mix-blend-overlay pointer-events-none"></div>
          </div>
        )}
        
        {/* Permission Error Overlay */}
        {permError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0d1321]/90 backdrop-blur-md border-2 border-red-500/30 p-6 z-20">
            <p className="text-red-400 font-bold text-center text-sm">
              Camera permission denied. Please allow camera access in your browser settings.
            </p>
          </div>
        )}
      </div>

      {/* Controls */}
      {!captured ? (
        <button
          type="button"
          onClick={captureNow}
          disabled={disabled || permError}
          className="w-full max-w-sm bg-[#f26644] hover:bg-[#e05535] text-white font-bold py-3.5 rounded-2xl transition-all duration-300 transform hover:-translate-y-1 shadow-lg shadow-[#f26644]/20 flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
        >
          <FiCamera size={18} />
          {label}
        </button>
      ) : (
        <div className="flex w-full max-w-sm gap-3">
          <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 shadow-inner">
            <FiCheckCircle size={16} /> Captured
          </div>
          <button 
            type="button" 
            onClick={retake} 
            className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <FiRefreshCw size={16} /> Retake
          </button>
        </div>
      )}
    </div>
  );
};

export default FaceCapture;