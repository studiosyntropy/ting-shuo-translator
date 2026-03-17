import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Mic, MicOff, Loader2, RefreshCw, ArrowRightLeft, Sun } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [sourceLang, setSourceLang] = useState<'en-US' | 'zh-TW'>('en-US');
  
  const recognitionRef = useRef<any>(null);
  const isShuttingDown = useRef(false); // New flag to prevent the "flicker"

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = sourceLang === 'zh-TW' ? 'cmn-Hant-TW' : 'en-US';

      recognition.onresult = (event: any) => {
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript;
        }
        if (final) {
          setInputText((prev) => (prev.endsWith(' ') ? prev + final : prev + ' ' + final));
        }
      };

      recognition.onend = () => {
        // Only turn off the "Listening" UI if we aren't in the middle of a forced shutdown
        if (!isShuttingDown.current) {
          setIsListening(false);
        }
      };
      
      recognitionRef.current = recognition;
    }
  }, [sourceLang]);

  const toggleListening = () => {
    if (isListening) {
      isShuttingDown.current = false;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      isShuttingDown.current = false;
      setResult(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) return;

    // 1. FORCE THE MIC TO KILL ITSELF IMMEDIATELY
    isShuttingDown.current = true; 
    recognitionRef.current?.stop();
    setIsListening(false);

    // 2. WAIT A TINY FRACTION FOR THE BROWSER TO SETTLE
    await new Promise(resolve => setTimeout(resolve, 300));

    setIsTranslating(true);
    setResult(null);
    
    try {
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Correct and translate this input: "${inputText.trim()}"
      Target: ${sourceLang === 'en-US' ? 'Traditional Chinese (Taiwan)' : 'English'}.
      Return ONLY JSON: {"corrected_source": "...", "translation": "...", "pinyin": "..."}`;

      const response = await model.generateContent(prompt);
      const text = await response.response.text();
      const jsonStr = text.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(jsonStr));
    } catch (err) {
      alert("AI Error. Please try again.");
    } finally {
      setIsTranslating(false);
      isShuttingDown.current = false; // Reset the flag for the next use
    }
  };

  return (
    <div className="min-h-screen p-6 bg-white text-stone-900">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-emerald-600">聽說 TīngShuō</h1>
        </header>

        <div className="bg-stone-100 p-4 rounded-2xl">
          <div className="flex justify-between mb-4">
            <button onClick={() => setSourceLang(sourceLang === 'en-US' ? 'zh-TW' : 'en-US')} className="bg-white px-3 py-1 rounded-lg text-sm font-bold flex gap-2">
              {sourceLang === 'en-US' ? 'EN' : 'ZH'} <ArrowRightLeft size={14}/> {sourceLang === 'en-US' ? 'ZH' : 'EN'}
            </button>
            <button 
              onClick={toggleListening} 
              className={`p-3 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-stone-200'}`}
            >
              {isListening ? <MicOff size={24}/> : <Mic size={24}/>}
            </button>
          </div>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tap mic to speak..."
            className="w-full h-40 bg-transparent border-0 text-xl resize-none focus:ring-0"
          />
        </div>

        <button 
          onClick={handleTranslate}
          disabled={isTranslating || !inputText}
          className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex justify-center items-center gap-2 disabled:opacity-50"
        >
          {isTranslating ? <Loader2 className="animate-spin"/> : <RefreshCw />} Correct & Translate
        </button>

        {result && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-xl">
              <p className="text-xs font-bold text-emerald-600 mb-1">CORRECTED SOURCE</p>
              <p className="text-lg">{result.corrected_source}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-xs font-bold text-blue-600 mb-1">TRANSLATION (TAIWAN)</p>
              <p className="text-xl font-medium">{result.translation}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl">
              <p className="text-xs font-bold text-amber-600 mb-1">PINYIN</p>
              <p className="text-lg italic">{result.pinyin}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}