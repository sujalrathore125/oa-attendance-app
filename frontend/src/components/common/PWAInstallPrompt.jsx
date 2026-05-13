import { useState, useEffect } from 'react';
import { FiDownload, FiX } from 'react-icons/fi';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-dismissed');
    if (dismissed) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  };

  const dismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-dismissed', '1');
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
      <div className="alert bg-primary text-primary-content shadow-xl rounded-2xl">
        <FiDownload size={22} className="shrink-0" />
        <div>
          <p className="font-bold text-sm">Install OA Attend</p>
          <p className="text-xs opacity-80">Add to home screen for quick access</p>
        </div>
        <div className="flex gap-2 ml-auto">
          <button className="btn btn-sm btn-ghost text-primary-content" onClick={dismiss}>
            <FiX />
          </button>
          <button className="btn btn-sm bg-white text-primary" onClick={install}>
            Install
          </button>
        </div>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;


// import { useState, useEffect } from 'react';
// import { motion, AnimatePresence } from 'motion/react';
// import { Download, X } from 'lucide-react';

// const AdminPWAInstallPrompt = () => {
//   const [deferredPrompt, setDeferredPrompt] = useState(null);
//   const [showBanner, setShowBanner] = useState(false);

//   useEffect(() => {
//     const dismissed = localStorage.getItem('pwa-dismissed');
//     if (dismissed) return;

//     const handler = (e) => {
//       e.preventDefault();
//       setDeferredPrompt(e);
//       setShowBanner(true);
//     };

//     window.addEventListener('beforeinstallprompt', handler);

//     return () =>
//       window.removeEventListener(
//         'beforeinstallprompt',
//         handler
//       );
//   }, []);

//   const install = async () => {
//     if (!deferredPrompt) return;

//     deferredPrompt.prompt();

//     const { outcome } =
//       await deferredPrompt.userChoice;

//     if (outcome === 'accepted')
//       setShowBanner(false);

//     setDeferredPrompt(null);
//   };

//   const dismiss = () => {
//     setShowBanner(false);
//     localStorage.setItem(
//       'pwa-dismissed',
//       '1'
//     );
//   };

//   return (
//     <AnimatePresence>
//       {showBanner && (
//         <motion.div
//           initial={{ opacity: 0, y: 40 }}
//           animate={{ opacity: 1, y: 0 }}
//           exit={{ opacity: 0, y: 40 }}
//           transition={{ duration: 0.4 }}
//           className="
//           fixed bottom-6 left-1/2
//           -translate-x-1/2
//           z-50
//           w-[calc(100%-2rem)]
//           max-w-md
//         "
//         >
//           <div
//             className="
//             backdrop-blur-xl
//             bg-white/10
//             border border-white/20
//             rounded-2xl
//             shadow-2xl
//             p-4
//             flex items-center gap-4
//           "
//           >
//             {/* Icon */}

//             <div
//               className="
//               w-11 h-11
//               rounded-xl
//               bg-gradient-to-br
//               from-orange-500
//               to-orange-600
//               flex items-center
//               justify-center
//               shadow-lg
//               shadow-orange-500/30
//             "
//             >
//               <Download className="size-5 text-white" />
//             </div>

//             {/* Text */}

//             <div className="flex-1">
//               <p className="font-semibold text-white">
//                 Install OA Attend
//               </p>

//               <p className="text-sm text-blue-200/70">
//                 Add to home screen for quick access
//               </p>
//             </div>

//             {/* Actions */}

//             <div className="flex items-center gap-2">
//               <button
//                 onClick={dismiss}
//                 className="
//                 w-9 h-9
//                 rounded-lg
//                 bg-white/10
//                 border border-white/20
//                 flex items-center
//                 justify-center
//                 text-blue-200
//                 hover:bg-white/20
//                 transition-all
//               "
//               >
//                 <X className="size-4" />
//               </button>

//               <button
//                 onClick={install}
//                 className="
//                 px-4 py-2
//                 rounded-lg
//                 bg-gradient-to-r
//                 from-orange-500
//                 to-orange-600
//                 text-white
//                 font-medium
//                 shadow-lg
//                 shadow-orange-500/30
//                 hover:shadow-orange-500/50
//                 transition-all
//               "
//               >
//                 Install
//               </button>
//             </div>
//           </div>
//         </motion.div>
//       )}
//     </AnimatePresence>
//   );
// };

// export default AdminPWAInstallPrompt;