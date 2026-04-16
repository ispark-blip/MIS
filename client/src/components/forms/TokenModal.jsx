import { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import api from '../../utils/api';

const DEPARTMENTS = {
  '문정': ['임상1팀', '임상2팀', '비임상팀'],
  '가산': ['시험검사팀', '특수시험팀'],
};

export default function TokenModal({ onClose }) {
  const [lab, setLab] = useState('문정');
  const [dept, setDept] = useState('임상1팀');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.post('/form-tokens', { department: dept, lab });
      const url = `${window.location.origin}${res.data.data.url}`;
      setGeneratedUrl(url);
    } catch (err) {
      alert(err.response?.data?.error?.message || '토큰 생성 실패');
    }
    setLoading(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm">입력폼 링크 생성</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">연구소</label>
            <select value={lab} onChange={(e) => { setLab(e.target.value); setDept(DEPARTMENTS[e.target.value][0]); }}
              className="w-full border rounded-md px-2 py-1.5 text-sm">
              <option value="문정">문정</option>
              <option value="가산">가산</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">부서</label>
            <select value={dept} onChange={(e) => setDept(e.target.value)}
              className="w-full border rounded-md px-2 py-1.5 text-sm">
              {DEPARTMENTS[lab].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {!generatedUrl ? (
            <button onClick={handleGenerate} disabled={loading}
              className="w-full bg-slate-800 text-white py-2 rounded-md text-sm hover:bg-slate-700 disabled:opacity-50">
              {loading ? '생성 중...' : '링크 생성'}
            </button>
          ) : (
            <div>
              <div className="flex items-center gap-1 bg-gray-50 border rounded-md p-2">
                <input type="text" value={generatedUrl} readOnly className="flex-1 bg-transparent text-xs outline-none" />
                <button onClick={handleCopy} className="text-gray-500 hover:text-gray-700">
                  {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">이 링크는 24시간 후 만료됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
