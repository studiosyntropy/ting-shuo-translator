import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Copy, Mic, MicOff, Loader2, RefreshCw, Check, Moon, Sun, ArrowRightLeft, Star, Trash2, ClipboardCopy } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface TranslationResult {
  id?: string;
  corrected_source: string;
  translation: string;
  pinyin: string;
  sourceLang?: string;
  targetLang?: string;
  timestamp?: number;
}

export default function App() {
  const [inputText, setInputText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [bulkCopiedId, setBulkCopiedId] = useState<string | null>(null);
  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sourceLang, setSourceLang] = useState<'en-US' | 'zh-TW'>('en-US');
  const [favorites, setFavorites] = useState<TranslationResult[]>([]);

  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef(false);

  useEffect(() => {
    // Load dark mode preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }

    // Load favorites from localStorage
    const savedFavs = localStorage.getItem('favorites');
    if (savedFavs) {
      try {
        setFavorites(JSON.parse(savedFavs));
      } catch (e) {
        console.error('Failed to parse favorites', e);
      }
    }

    // Initialize Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let currentInterim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            currentInterim += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setInputText((prev) => prev + (prev ? ' ' : '') + finalTranscript);
          setInterimText('');
        } else {
          setInterimText(currentInterim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          manualStopRef.current = true;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (!manualStopRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error('Failed to restart recognition', e);
            setIsListening(false);
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleLanguage = () => {
    setSourceLang(prev => prev === 'en-US' ? 'zh-TW' : 'en-US');
  };

  const toggleListening = () => {
    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (recognitionRef.current) {
        try {
          manualStopRef.current = false;
          // Update the SpeechRecognition language parameter to match the sourceLang
          recognitionRef.current.lang = sourceLang === 'zh-TW' ? 'cmn-Hant-TW' : 'en-US';
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error(e);
        }
      } else {
        alert('Speech recognition is not supported in this browser.');
      }
    }
  };

  const handleTranslate = async () => {
    const fullText = (inputText + (interimText ? ' ' + interimText : '')).trim();
    if (!fullText) return;

    if (isListening) {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    setInputText(fullText);
    setInterimText('');
    setIsTranslating(true);
    setError(null);
    setResult(null);

    const sourceName = sourceLang === 'en-US' ? 'English' : 'Taiwanese Traditional Chinese';
    const targetName = sourceLang === 'en-US' ? 'Taiwanese Traditional Chinese' : 'English';

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Process the following raw speech-to-text input:\n\n"${fullText}"`,
        config: {
          systemInstruction: `You are an expert bilingual translator and editor specializing in English and Taiwanese Traditional Chinese. Your goal is to process Speech-to-Text (STT) input and provide high-quality, natural-sounding translations and corrections.

Source language: ${sourceName}
Target language: ${targetName}

Core Objectives:
1. Auto-Correction: Analyze the input text (which may contain STT errors) and correct spelling, grammar, and sentence flow in the source language (${sourceName}) before translating.
2. Translation: Translate the corrected text naturally from ${sourceName} into ${targetName}.
3. Taiwanese Localization: When translating into Traditional Chinese, use vocabulary and phrasing specific to Taiwan. Avoid literal translations; instead, use expressions a native Taiwanese person would use, while strictly maintaining the original meaning and intent.
4. Specific Terminology: You MUST use the following terms for technical contexts:
    - "Target crop" -> "主要作物"
    - "Soil food web" -> "土壤食物網"
    - "Rhizophagy cycle" -> "根噬循環"
    - "Natural cycles" -> "大自然循環"
    - "Succession" -> "演替"
    - "Strata" -> "分層"
    - "Syntropic agroforestry" -> "趨合農業"
5. Formatting: Provide the output in a structured format (JSON) so the application can separate the English, Chinese, and Pinyin into individual text fields with their own copy buttons.

Output Structure:
Return ONLY a JSON object with the following keys:
- "corrected_source": The input text after spelling and grammar fixes.
- "translation": The localized translation.
- "pinyin": The Hanyu Pinyin for the Chinese text (without the Hanzi characters).

Tone and Style:
- Conversational and natural.
- Polite but direct.
- For English translations, use modern, idiomatic English.`,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              corrected_source: { type: Type.STRING, description: "The input text after spelling and grammar fixes." },
              translation: { type: Type.STRING, description: "The localized translation." },
              pinyin: { type: Type.STRING, description: "The Hanyu Pinyin for the Chinese text (without the Hanzi characters)." }
            },
            required: ["corrected_source", "translation", "pinyin"]
          }
        }
      });

      if (response.text) {
        const parsedResult = JSON.parse(response.text) as TranslationResult;
        parsedResult.sourceLang = sourceLang;
        parsedResult.targetLang = sourceLang === 'en-US' ? 'zh-TW' : 'en-US';
        parsedResult.id = Date.now().toString();
        parsedResult.timestamp = Date.now();
        setResult(parsedResult);
      } else {
        throw new Error('No response from AI');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during translation.');
    } finally {
      setIsTranslating(false);
    }
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleBulkCopy = (fav: TranslationResult) => {
    const textToCopy = `Source: ${fav.corrected_source}\n\nTranslation: ${fav.translation}\n\nPinyin: ${fav.pinyin}`;
    navigator.clipboard.writeText(textToCopy);
    setBulkCopiedId(fav.id || null);
    setTimeout(() => setBulkCopiedId(null), 2000);
  };

  const toggleFavorite = () => {
    if (!result) return;
    
    const isFav = favorites.some(f => f.id === result.id);
    let newFavs;
    if (isFav) {
      newFavs = favorites.filter(f => f.id !== result.id);
    } else {
      newFavs = [result, ...favorites];
    }
    setFavorites(newFavs);
    // Persist to localStorage
    localStorage.setItem('favorites', JSON.stringify(newFavs));
  };

  const deleteFavorite = (id: string) => {
    const newFavs = favorites.filter(f => f.id !== id);
    setFavorites(newFavs);
    // Persist to localStorage
    localStorage.setItem('favorites', JSON.stringify(newFavs));
  };

  const isCurrentResultFavorite = result && favorites.some(f => f.id === result.id);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDarkMode ? 'dark bg-[#121212] text-[#ffffff]' : 'bg-[#ffffff] text-[#121212]'}`}>
      {/* Top Navigation */}
      <nav className="p-4 flex justify-end max-w-4xl mx-auto">
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors"
          aria-label="Toggle Dark Mode"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </nav>

      <div className="max-w-4xl mx-auto space-y-8 p-6 md:p-12 pt-4">
        <header className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-emerald-900 dark:text-emerald-400">
            聽說 TīngShuō
          </h1>
          <p className="text-stone-500 dark:text-stone-400 max-w-2xl mx-auto">
            Natural translation for Taiwan.
          </p>
        </header>

        <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden transition-colors">
          <div className="p-6 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-[#1e1e1e] flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            
            {/* Language Swap */}
            <div className="flex items-center gap-3 bg-stone-100 dark:bg-stone-800 p-2 rounded-xl w-full sm:w-auto justify-center">
              <span className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100 text-center flex-1 sm:flex-none">
                {sourceLang === 'en-US' ? 'English' : 'Traditional Chinese'}
              </span>
              <button 
                onClick={toggleLanguage}
                className="p-2 hover:bg-stone-200 dark:hover:bg-stone-600 rounded-md transition-colors shrink-0"
                title="Swap Languages"
              >
                <ArrowRightLeft className="w-5 h-5 text-stone-600 dark:text-stone-300" />
              </button>
              <span className="px-3 py-2 text-sm font-medium rounded-lg bg-white dark:bg-stone-700 shadow-sm text-stone-900 dark:text-stone-100 text-center flex-1 sm:flex-none">
                {sourceLang === 'en-US' ? 'Traditional Chinese' : 'English'}
              </span>
            </div>

            <button
              onClick={toggleListening}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full text-base font-medium transition-colors w-full sm:w-auto my-2 sm:my-0 ${
                isListening 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50' 
                  : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700'
              }`}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" /> Stop Listening
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" /> Start Dictation
                </>
              )}
            </button>
          </div>
          <div className="p-4 sm:p-6">
            <textarea
              value={inputText + (interimText ? (inputText ? ' ' : '') + interimText : '')}
              onChange={(e) => {
                setInputText(e.target.value);
                setInterimText('');
              }}
              placeholder={sourceLang === 'zh-TW' ? '請在此輸入或對話 (繁體中文)...' : 'Type or dictate your text here (English)...'}
              className="w-full min-h-[16rem] p-3 bg-transparent border-0 focus:ring-0 resize-none text-lg placeholder:text-stone-400 dark:placeholder:text-stone-500 dark:text-white"
            />
          </div>
          <div className="p-4 bg-stone-50 dark:bg-[#1e1e1e] border-t border-stone-100 dark:border-stone-800 flex justify-end">
            <button
              onClick={handleTranslate}
              disabled={isTranslating || (!inputText.trim() && !interimText.trim())}
              className="mt-2 sm:mt-4 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" /> Correct & Translate
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30">
            {error}
          </div>
        )}

        {isTranslating && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 transition-colors">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 dark:text-emerald-400" />
            <p className="text-lg font-medium text-stone-600 dark:text-stone-300">Processing translation...</p>
          </div>
        )}

        {!isTranslating && result && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={toggleFavorite}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isCurrentResultFavorite
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700'
                }`}
              >
                <Star className={`w-4 h-4 ${isCurrentResultFavorite ? 'fill-current' : ''}`} />
                {isCurrentResultFavorite ? 'Saved to Favorites' : 'Save to Favorites'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <OutputCard 
                title="Corrected Source" 
                content={result.corrected_source} 
                onCopy={() => copyToClipboard(result.corrected_source, 'corrected_source')}
                isCopied={copiedField === 'corrected_source'}
              />
              <OutputCard 
                title="Translation" 
                content={result.translation} 
                onCopy={() => copyToClipboard(result.translation, 'translation')}
                isCopied={copiedField === 'translation'}
              />
              <OutputCard 
                title="Pinyin" 
                content={result.pinyin} 
                onCopy={() => copyToClipboard(result.pinyin, 'pinyin')}
                isCopied={copiedField === 'pinyin'}
                isPinyin={true}
              />
            </div>
          </div>
        )}

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div className="pt-12 space-y-6">
            <h2 className="text-2xl font-semibold text-stone-800 dark:text-stone-200 border-b border-stone-200 dark:border-stone-800 pb-2">
              Favorites
            </h2>
            <div className="space-y-4">
              {favorites.map((fav) => (
                <div key={fav.id} className="bg-white dark:bg-[#1e1e1e] rounded-xl shadow-sm border border-stone-200 dark:border-stone-800 p-4 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded">
                      {fav.sourceLang === 'en-US' ? 'EN → ZH' : 'ZH → EN'}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBulkCopy(fav)}
                        className="text-stone-400 hover:text-emerald-500 transition-colors p-1 flex items-center gap-1"
                        title="Bulk Copy"
                      >
                        {bulkCopiedId === fav.id ? <Check className="w-4 h-4 text-emerald-500" /> : <ClipboardCopy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => fav.id && deleteFavorite(fav.id)}
                        className="text-stone-400 hover:text-red-500 transition-colors p-1"
                        title="Delete Favorite"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Source</h4>
                      <p className="text-sm text-stone-800 dark:text-white">{fav.corrected_source}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Translation</h4>
                      <p className="text-sm text-stone-800 dark:text-white">{fav.translation}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1">Pinyin</h4>
                      <p className="text-base md:text-lg text-yellow-600 dark:text-yellow-300 font-medium">{fav.pinyin}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OutputCard({ title, content, onCopy, isCopied, isPinyin = false }: { title: string, content: string, onCopy: () => void, isCopied: boolean, isPinyin?: boolean }) {
  return (
    <div className="bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col h-full transition-colors">
      <div className="p-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-[#1e1e1e] flex justify-between items-center">
        <h3 className="font-medium text-stone-700 dark:text-stone-300">{title}</h3>
        <button
          onClick={onCopy}
          className="p-2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors"
          title="Copy to clipboard"
        >
          {isCopied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="p-4 flex-grow flex">
        <textarea
          readOnly
          value={content}
          className={`w-full h-48 md:h-64 p-0 bg-transparent border-0 focus:ring-0 resize-none leading-relaxed ${
            isPinyin 
              ? 'text-lg md:text-xl text-stone-800 dark:text-yellow-300 font-medium' 
              : 'text-stone-800 dark:text-white'
          }`}
        />
      </div>
    </div>
  );
}
