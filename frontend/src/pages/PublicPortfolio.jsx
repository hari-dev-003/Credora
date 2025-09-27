import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebaseconfig';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore';
import Spinner from '../components/Spinner';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Reusable Portfolio Components ---

// 1. The Profile Header: Your Digital Handshake
const ProfileHeader = ({ studentInfo, isOwner }) => {
    const [headline, setHeadline] = useState(studentInfo.professionalHeadline || '');
    const [isGenerating, setIsGenerating] = useState(false);

    const generateHeadline = async () => {
        setIsGenerating(true);
        toast.loading("Generating AI headline...");

        const skills = studentInfo.skillSet?.slice(0, 5).join(', ') || 'various fields';
        const prompt = `Generate one short, impactful, and professional headline (max 15 words) for a ${studentInfo.year} ${studentInfo.department} student with skills in ${skills}. The student's goal is to find an internship or full-time role. The response should be only the headline text itself, without any introductory phrases or quotation marks.`;

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
            if (!response.ok) throw new Error("API Error");
            const result = await response.json();
            const generatedText = result.candidates?.[0]?.content?.parts?.[0]?.text.trim().replace(/"/g, ''); // Remove quotes and trim whitespace
            
            setHeadline(generatedText);
            
            // Save to user's profile
            const userRef = doc(db, "users", studentInfo.uid);
            await updateDoc(userRef, { professionalHeadline: generatedText });
            
            toast.dismiss();
            toast.success("Headline generated and saved!");
        } catch (error) {
            console.error("Headline generation failed:", error);
            toast.dismiss();
            toast.error("Could not generate headline.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="portfolio-header flex flex-col items-center text-center p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 opacity-0">
            <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${studentInfo.name}`} alt={studentInfo.name} className="w-24 h-24 rounded-full border-4 border-cyan-400 mb-4" />
            <h1 className="text-3xl md:text-4xl font-bold text-white">{studentInfo.name}</h1>
            {/* --- FIX: Adjusted styling for flexible height --- */}
            <p className="text-md text-cyan-400 mt-2 min-h-[3rem] flex items-center justify-center max-w-md">
                {headline || `A passionate ${studentInfo.year} ${studentInfo.department} student.`}
            </p>
            {isOwner && (
                <button onClick={generateHeadline} disabled={isGenerating} className="mt-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1 px-3 rounded-md transition disabled:bg-indigo-800">
                    {isGenerating ? 'Generating...' : '✨ Generate AI Headline'}
                </button>
            )}
        </div>
    );
};

// 2. The "At-a-Glance" Dashboard
const AtAGlance = ({ achievements, skills }) => (
    <div className="at-a-glance grid grid-cols-2 md:grid-cols-3 gap-4 opacity-0">
        <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{achievements.length}</p>
            <p className="text-xs text-gray-400">Achievements</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-white">{skills.length}</p>
            <p className="text-xs text-gray-400">Verified Skills</p>
        </div>
        <div className="bg-gray-800 p-4 rounded-lg text-center col-span-2 md:col-span-1">
             <p className="text-2xl font-bold text-white">Top Tier</p>
            <p className="text-xs text-gray-400">Performance</p>
        </div>
    </div>
);

// 3. The Skills Hub
const SkillsHub = ({ skills, activeSkill, onSkillClick }) => (
    <div className="skills-hub bg-gray-800 p-6 rounded-xl border border-gray-700 opacity-0">
        <h2 className="text-xl font-semibold text-white mb-4">Skills Hub</h2>
        <div className="flex flex-wrap gap-2">
            <button onClick={() => onSkillClick(null)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${!activeSkill ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-cyan-300 hover:bg-gray-600'}`}>
                All Skills
            </button>
            {skills.map((skill, index) => (
                <button key={index} onClick={() => onSkillClick(skill)} className={`text-xs font-medium px-3 py-1.5 rounded-full transition ${activeSkill === skill ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-cyan-300 hover:bg-gray-600'}`}>
                    {skill}
                </button>
            ))}
        </div>
    </div>
);


// 4. The Achievement Timeline & Showcase Card
const AchievementTimeline = ({ achievements }) => (
    <div className="achievement-timeline space-y-8 relative opacity-0">
        {/* The vertical line on desktop */}
        <div className="hidden md:block absolute left-4 top-2 bottom-2 w-0.5 bg-gray-700"></div>
        {achievements.map(ach => (
            <div key={ach.id} className="timeline-item flex items-start gap-4">
                <div className="hidden md:flex flex-shrink-0 w-8 h-8 bg-gray-700 rounded-full items-center justify-center mt-1">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                </div>
                <div className="flex-1 bg-gray-800 p-6 rounded-xl border border-gray-700 w-full">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="text-xl font-bold text-cyan-400">{ach.title}</h3>
                        <span className="text-xs font-semibold bg-green-500/20 text-green-300 px-3 py-1 rounded-full flex-shrink-0">VERIFIED</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{new Date(ach.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p className="text-gray-300 leading-relaxed">{ach.description}</p>
                </div>
            </div>
        ))}
    </div>
);

// --- Hidden Component for Professional PDF Export ---
const PdfLayout = React.forwardRef(({ studentInfo, achievements }, ref) => {
    if (!studentInfo || !achievements) return null;

    const top3Projects = achievements.slice(0, 3);

    return (
        <div ref={ref} className="pdf-container" style={{ width: '8.5in', height: '11in', padding: '0.5in', backgroundColor: 'white', color: 'black', fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #ccc', paddingBottom: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0 }}>{studentInfo.name}</h1>
                    <p style={{ fontSize: '14px', color: '#555', margin: '4px 0 0' }}>{studentInfo.professionalHeadline || `A passionate ${studentInfo.year} ${studentInfo.department} student.`}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', margin: 0 }}>{studentInfo.email}</p>
                    <a href={`${window.location.origin}/portfolio/${studentInfo.uid}`} style={{ fontSize: '12px', color: '#007BFF', textDecoration: 'none' }}>
                        Live Portfolio Link
                    </a>
                </div>
            </div>

            {/* Two-Column Body */}
            <div style={{ display: 'flex', gap: '32px', marginTop: '24px' }}>
                {/* Left Column (Main Content) */}
                <div style={{ width: '70%' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '16px' }}>PROFESSIONAL SUMMARY</h2>
                    <p style={{ fontSize: '12px', lineHeight: '1.6' }}>{/* Placeholder for AI summary */ `Driven and detail-oriented ${studentInfo.department} student with a proven ability to leverage skills in ${studentInfo.skillSet?.slice(0,3).join(', ')} to deliver high-quality projects. Seeking to apply academic knowledge and practical experience to a challenging role.`}</p>
                    
                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '16px', marginTop: '24px' }}>PROJECT EXPERIENCE</h2>
                    {top3Projects.map(p => (
                        <div key={p.id} style={{ marginBottom: '16px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>{p.title}</h3>
                            <p style={{ fontSize: '12px', lineHeight: '1.6', margin: '4px 0' }}>{p.description}</p>
                        </div>
                    ))}
                </div>
                {/* Right Column (Skills & Education) */}
                <div style={{ width: '30%' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>SKILLS</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {studentInfo.skillSet?.map(s => <span key={s} style={{ fontSize: '10px', backgroundColor: '#eee', padding: '4px 8px', borderRadius: '12px' }}>{s}</span>)}
                    </div>
                    
                     <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px', marginTop: '24px' }}>EDUCATION</h2>
                     <p style={{ fontSize: '12px', margin: 0, fontWeight: 'bold' }}>{studentInfo.department}</p>
                     <p style={{ fontSize: '12px', margin: 0 }}>{studentInfo.year}, Section {studentInfo.section}</p>
                </div>
            </div>
        </div>
    );
});


// --- Main Public Portfolio Component ---
const PublicPortfolio = () => {
    const { studentId } = useParams();
    const navigate = useNavigate();
    const [studentInfo, setStudentInfo] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [activeSkill, setActiveSkill] = useState(null);
    const pdfRef = useRef(null);
    const currentUser = auth.currentUser;
    const isOwner = currentUser?.uid === studentId;

    useEffect(() => {
        if (!studentId) { setIsLoading(false); return; }

        const fetchStudentInfo = async () => {
            const docRef = doc(db, "users", studentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) setStudentInfo({ uid: docSnap.id, ...docSnap.data() });
            else console.error("Could not find student profile.");
        };
        fetchStudentInfo();

        const q = query(collection(db, "achievements"), where("studentId", "==", studentId), where("status", "==", "verified"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            let achs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            achs.sort((a, b) => new Date(b.date) - new Date(a.date));
            setAchievements(achs);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [studentId]);

    useEffect(() => {
        if (studentInfo) {
            window.anime({ targets: '.portfolio-header, .at-a-glance, .skills-hub, .achievement-timeline', translateY: [-20, 0], opacity: [0, 1], duration: 800, delay: window.anime.stagger(100), easing: 'easeOutExpo' });
        }
    }, [studentInfo]);

    const handleDownloadPdf = () => {
        const input = pdfRef.current;
        if (!input) return;
        setIsDownloading(true);
        toast.loading("Generating PDF...");

        html2canvas(input, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'in', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${studentInfo.name.replace(' ', '_')}-Portfolio.pdf`);
            
            toast.dismiss();
            toast.success("Portfolio downloaded!");
            setIsDownloading(false);
        }).catch(err => {
            console.error("PDF generation failed:", err);
            toast.dismiss();
            toast.error("Could not generate PDF.");
            setIsDownloading(false);
        });
    };
    
    const filteredAchievements = activeSkill 
        ? achievements.filter(ach => ach.description.toLowerCase().includes(activeSkill.toLowerCase())) 
        : achievements;

    if (isLoading) return <Spinner />;
    if (!studentInfo) return <div className="min-h-screen bg-gray-900 text-center p-8"><p className="text-red-400">Could not load student profile.</p></div>

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 md:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    {/* Header is now part of this flex container for alignment */}
                    <div className="flex-grow">
                        {/* We render a simplified header here for layout purposes */}
                    </div>
                     <button onClick={handleDownloadPdf} disabled={isDownloading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition disabled:bg-indigo-800 flex items-center gap-2 flex-shrink-0">
                         {isDownloading ? <Spinner /> : '📄'}
                         {isDownloading ? 'Generating...' : 'Download as PDF'}
                    </button>
                </div>

                <ProfileHeader studentInfo={studentInfo} isOwner={isOwner} />
                <AtAGlance achievements={achievements} skills={studentInfo.skillSet || []} />
                <SkillsHub skills={studentInfo.skillSet || []} activeSkill={activeSkill} onSkillClick={setActiveSkill} />
                <AchievementTimeline achievements={filteredAchievements} />
                
                <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-8">
                    <button onClick={() => navigate(-1)} className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition">
                        &larr; Go Back
                    </button>
                </div>
            </div>
            {/* The hidden div for PDF rendering */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <PdfLayout ref={pdfRef} studentInfo={studentInfo} achievements={achievements} />
            </div>
        </div>
    );
};

export default PublicPortfolio;

