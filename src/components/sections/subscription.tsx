import { SubscriptionForm } from '@/components/subscription-form';

export function SubscriptionSection() {
  return (
    <section id="subscribe" className="py-24 md:py-40 bg-[#0A0A0B] w-full relative overflow-hidden">
      {/* Topographic contour line background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]">
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1200 800"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Outer contour rings */}
          <path d="M600 400 C600 200, 900 150, 1000 300 C1100 450, 950 600, 750 620 C550 640, 350 580, 280 450 C210 320, 350 180, 600 400Z" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M600 400 C600 240, 860 190, 950 320 C1040 450, 910 570, 730 590 C550 610, 380 560, 320 450 C260 340, 380 220, 600 400Z" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M600 400 C600 280, 820 230, 900 340 C980 450, 870 540, 710 560 C550 580, 410 540, 360 450 C310 360, 410 260, 600 400Z" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M600 400 C600 310, 780 270, 855 350 C930 430, 840 510, 700 530 C560 550, 440 520, 400 445 C360 370, 440 300, 600 400Z" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M600 400 C600 340, 740 310, 810 365 C880 420, 810 485, 690 500 C570 515, 470 490, 440 440 C410 390, 470 340, 600 400Z" stroke="#ffffff" strokeWidth="1.2" />
          <path d="M600 400 C600 365, 700 345, 760 380 C820 415, 775 460, 680 470 C585 480, 510 465, 485 435 C460 405, 510 375, 600 400Z" stroke="#ffffff" strokeWidth="1.2" />

          {/* Second cluster — upper left */}
          <path d="M250 200 C200 100, 400 50, 480 150 C560 250, 450 350, 330 340 C210 330, 150 280, 250 200Z" stroke="#ffffff" strokeWidth="1" />
          <path d="M270 210 C230 130, 390 90, 450 170 C510 250, 420 320, 330 315 C240 310, 190 265, 270 210Z" stroke="#ffffff" strokeWidth="1" />
          <path d="M290 220 C260 160, 380 130, 420 190 C460 250, 400 300, 330 295 C260 290, 230 255, 290 220Z" stroke="#ffffff" strokeWidth="1" />
          <path d="M310 235 C290 190, 370 170, 395 210 C420 250, 385 280, 340 278 C295 276, 270 255, 310 235Z" stroke="#ffffff" strokeWidth="1" />

          {/* Third cluster — lower right */}
          <path d="M900 600 C850 500, 1050 460, 1120 550 C1190 640, 1080 740, 960 730 C840 720, 800 680, 900 600Z" stroke="#ffffff" strokeWidth="1" />
          <path d="M915 610 C875 530, 1030 500, 1090 570 C1150 640, 1060 720, 955 710 C850 700, 820 670, 915 610Z" stroke="#ffffff" strokeWidth="1" />
          <path d="M930 620 C900 560, 1010 540, 1060 590 C1110 640, 1040 700, 955 695 C870 690, 845 660, 930 620Z" stroke="#ffffff" strokeWidth="1" />
          <path d="M945 635 C925 590, 995 575, 1030 610 C1065 645, 1020 680, 960 678 C900 676, 880 655, 945 635Z" stroke="#ffffff" strokeWidth="1" />

          {/* Small accent cluster — top right */}
          <path d="M950 120 C920 60, 1060 40, 1100 100 C1140 160, 1070 220, 990 210 C910 200, 880 170, 950 120Z" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M965 135 C945 90, 1040 75, 1070 115 C1100 155, 1050 195, 990 190 C930 185, 910 160, 965 135Z" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M980 148 C968 118, 1025 108, 1045 132 C1065 156, 1035 178, 1000 175 C965 172, 955 160, 980 148Z" stroke="#ffffff" strokeWidth="0.8" />

          {/* Small accent cluster — bottom left */}
          <path d="M100 620 C70 560, 200 530, 250 590 C300 650, 230 710, 160 700 C90 690, 60 670, 100 620Z" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M120 630 C100 585, 195 565, 230 610 C265 655, 215 695, 165 688 C115 681, 90 660, 120 630Z" stroke="#ffffff" strokeWidth="0.8" />
          <path d="M140 645 C128 615, 185 600, 210 630 C235 660, 200 685, 168 680 C136 675, 120 660, 140 645Z" stroke="#ffffff" strokeWidth="0.8" />

          {/* Subtle long flowing lines across the canvas */}
          <path d="M0 350 C150 320, 300 380, 450 340 C600 300, 750 370, 900 330 C1050 290, 1150 350, 1200 320" stroke="#ffffff" strokeWidth="0.6" />
          <path d="M0 450 C150 420, 280 470, 430 440 C580 410, 720 460, 870 430 C1020 400, 1120 450, 1200 430" stroke="#ffffff" strokeWidth="0.6" />
          <path d="M0 550 C120 530, 260 570, 400 540 C540 510, 680 560, 820 535 C960 510, 1100 555, 1200 540" stroke="#ffffff" strokeWidth="0.6" />
        </svg>
      </div>

      <div className="container mx-auto px-4 text-center relative z-10">
        <h2 className="font-nunito text-5xl md:text-7xl text-white font-bold tracking-tight drop-shadow-xl">Want In?</h2>
        <p className="mt-6 text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto font-light leading-relaxed">
          Join the inner circle. Be the first to know about new releases, exclusive content, and upcoming architectural events.
        </p>
        <div className="mt-12 max-w-2xl mx-auto p-4 md:p-8 bg-white/5 border border-white/10 rounded-3xl backdrop-blur-2xl shadow-2xl">
          <SubscriptionForm />
        </div>
      </div>
    </section>
  );
}