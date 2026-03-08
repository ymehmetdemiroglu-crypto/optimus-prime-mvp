import { useState } from 'react';
import { reportsApi } from '../api/client';
import { Upload, FileText, AlertTriangle, CheckCircle, ArrowRight, Loader } from 'lucide-react';

interface ReportInsight {
    title: string;
    description: string;
    impact: string;
    actionable_step: string;
}

interface ReportAnalysisResponse {
    summary: string;
    insights: ReportInsight[];
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function validateCsvFile(f: File): string | null {
    if (f.type !== 'text/csv' && f.type !== 'application/csv' && !f.name.endsWith('.csv')) {
        return 'Please upload a valid CSV file.';
    }
    if (f.size > MAX_FILE_SIZE) {
        return 'File exceeds the 10 MB limit. Please upload a smaller file.';
    }
    return null;
}

export default function Reports() {
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [analysis, setAnalysis] = useState<ReportAnalysisResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (!droppedFile) return;
        const validationError = validateCsvFile(droppedFile);
        if (validationError) { setError(validationError); } else { setFile(droppedFile); setError(null); }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            const validationError = validateCsvFile(selectedFile);
            if (validationError) { setError(validationError); } else { setFile(selectedFile); setError(null); }
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);
        setAnalysis(null);

        try {
            const result = await reportsApi.uploadReport(file);
            setAnalysis(result);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'An error occurred during analysis.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="min-h-screen p-6 lg:p-8">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-2 flex items-center gap-3">
                            <FileText className="w-6 h-6 text-prime-blue" />
                            Report Analysis
                        </h1>
                        <p className="text-sm text-prime-silver tracking-wide font-medium">
                            Upload your performance data CSV. Optimus will instantly identify waste and uncover scale opportunities.
                        </p>
                    </div>
                </div>

                {/* Upload Section */}
                {!analysis && (
                    <div className="card">
                        <div className="card-header border-b border-prime-gunmetal/30 pb-4 mb-4">
                            <h2 className="text-sm font-black text-white uppercase tracking-wider">
                                Upload Data Source
                            </h2>
                        </div>

                        <div
                            className={`border-2 border-dashed transition-all duration-300 rounded-lg p-12 text-center flex flex-col items-center justify-center space-y-4
                                ${isDragging ? 'border-prime-blue bg-prime-blue/10' : 'border-prime-gunmetal hover:border-prime-silver/50 hover:bg-prime-gunmetal/10'}
                            `}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                        >
                            <div className={`p-4 rounded-full ${isDragging ? 'bg-prime-blue/20' : 'bg-prime-dark border border-prime-gunmetal'}`}>
                                <Upload className={`w-8 h-8 ${isDragging ? 'text-prime-blue' : 'text-prime-silver'}`} />
                            </div>

                            <div>
                                <p className="text-lg font-bold text-white mb-1">
                                    {file ? file.name : 'Drag & Drop CSV File'}
                                </p>
                                <p className="text-xs text-prime-gunmetal uppercase tracking-wider font-semibold">
                                    {file ? `${(file.size / 1024).toFixed(1)} KB` : 'or click to browse from your computer'}
                                </p>
                            </div>

                            {!file && (
                                <label className="btn-primary mt-4 cursor-pointer">
                                    Browse Files
                                    <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                                </label>
                            )}

                            {error && (
                                <div className="mt-4 flex items-center gap-2 text-prime-red bg-prime-red/10 px-4 py-2 rounded text-sm font-semibold">
                                    <AlertTriangle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </div>

                        {file && (
                            <div className="mt-6 flex justify-end">
                                <button
                                    className="btn-primary flex items-center gap-2 px-8"
                                    onClick={handleUpload}
                                    disabled={isUploading}
                                >
                                    {isUploading ? (
                                        <>
                                            <Loader className="w-4 h-4 animate-spin" />
                                            Analyzing Data...
                                        </>
                                    ) : (
                                        <>
                                            Run Optimus Analysis
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Analysis Results */}
                {analysis && (
                    <div className="space-y-6 animate-fade-in">

                        {/* Summary Card */}
                        <div className="card relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-prime-blue/10 rounded-full blur-3xl -mr-10 -mt-10" />
                            <div className="card-header mb-4 relative z-10 flex justify-between items-center">
                                <h2 className="text-sm font-black text-prime-blue uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Executive Summary
                                </h2>
                                <button
                                    onClick={() => { setAnalysis(null); setFile(null); }}
                                    className="text-xs text-prime-gunmetal hover:text-white uppercase tracking-wider font-bold underline decoration-prime-gunmetal/50 underline-offset-4"
                                >
                                    Analyze Another Report
                                </button>
                            </div>
                            <p className="text-white text-sm leading-relaxed relative z-10">
                                {analysis.summary}
                            </p>
                        </div>

                        {/* Insights Grid */}
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 border-l-2 border-prime-red pl-3">
                                Actionable Insights
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {analysis.insights.map((insight) => (
                                    <div key={insight.title} className="bg-prime-dark/60 border border-prime-gunmetal/30 p-5 chamfer group hover:border-prime-silver/50 transition-all duration-300 flex flex-col justify-between h-full">
                                        <div>
                                            <h4 className="text-sm font-bold text-white mb-2 group-hover:text-prime-blue transition-colors">
                                                {insight.title}
                                            </h4>
                                            <p className="text-xs text-prime-silver mb-4 leading-relaxed">
                                                {insight.description}
                                            </p>
                                        </div>
                                        <div>
                                            <div className="bg-prime-dark border border-prime-gunmetal/20 p-3 mb-3">
                                                <span className="text-[10px] text-prime-red uppercase tracking-widest font-bold block mb-1">Business Impact</span>
                                                <span className="text-sm text-white font-semibold">{insight.impact}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-prime-energon">
                                                <ArrowRight className="w-4 h-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">{insight.actionable_step}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
}
