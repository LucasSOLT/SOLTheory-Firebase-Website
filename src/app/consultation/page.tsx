'use client';

import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useState } from 'react';

export default function ConsultationPage() {
  const [selectedDate, setSelectedDate] = useState<number | null>(null);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const timeSlots = [
    "09:00 AM", "10:30 AM", "11:00 AM", "01:00 PM", "02:30 PM", "04:00 PM"
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <div className="absolute top-0 w-full z-50 fixed">
        <Header />
      </div>

      <main className="flex-grow z-10 w-full relative pt-32 pb-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="font-nunito text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
              Schedule a <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Consultation</span>
            </h1>
            <p className="text-slate-400 text-lg">Choose a time that works best for you to discuss your custom solution.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Calendar View */}
            <Card className="md:col-span-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <CardHeader className="border-b border-white/5 flex flex-row items-center justify-between p-6">
                <CardTitle className="text-xl font-bold text-white">May 2026</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5">
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-white/5">
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-2">
                  {/* Padding for first day of month if needed - assuming May 1 is Friday for this mock */}
                  <div className="h-12" />
                  <div className="h-12" />
                  <div className="h-12" />
                  <div className="h-12" />
                  <div className="h-12" />
                  {days.map(day => (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(day)}
                      className={`h-12 rounded-xl border flex items-center justify-center text-sm font-semibold transition-all
                        ${selectedDate === day 
                          ? 'bg-fuchsia-600 border-fuchsia-500 text-white shadow-[0_0_15px_rgba(192,38,211,0.5)]' 
                          : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'}`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Time Slots */}
            <Card className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
              <CardHeader className="border-b border-white/5 p-6">
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-400" />
                  Available Times
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {timeSlots.map(time => (
                    <button
                      key={time}
                      className="w-full py-4 rounded-xl border border-white/10 bg-white/5 text-slate-300 font-semibold hover:bg-white/10 hover:border-white/20 transition-all text-center"
                    >
                      {time}
                    </button>
                  ))}
                </div>
                {selectedDate && (
                  <div className="mt-8">
                    <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-bold shadow-lg hover:shadow-fuchsia-500/20 transition-all">
                      Confirm Appointment
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
