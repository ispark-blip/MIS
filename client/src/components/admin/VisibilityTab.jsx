import { useEffect, useState } from 'react';
import api from '../../utils/api';
import { Save, Eye, EyeOff } from 'lucide-react';

function parseJsonArr(v) {
  if (!v) return [];
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export default function VisibilityTab({ settings, onSaved }) {
  const [options, setOptions] = useState({ salesDepartments: [], labs: [], q1Entities: [] });
  const [hiddenSalesDepts, setHiddenSalesDepts] = useState(new Set());
  const [hiddenTestCountDepts, setHiddenTestCountDepts] = useState(new Set());
  const [hiddenLabs, setHiddenLabs] = useState(new Set());
  const [hiddenQ1Entities, setHiddenQ1Entities] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.get('/settings/filter-options')
      .then(r => setOptions(r.data.data || { salesDepartments: [], labs: [], q1Entities: [] }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (settings) {
      setHiddenSalesDepts(new Set(parseJsonArr(settings.hidden_sales_departments)));
      setHiddenTestCountDepts(new Set(parseJsonArr(settings.hidden_test_count_departments)));
      setHiddenLabs(new Set(parseJsonArr(settings.hidden_summary_labs)));
      setHiddenQ1Entities(new Set(parseJsonArr(settings.hidden_q1_entities)));
    }
  }, [settings]);

  const toggle = (setter, current, name) => {
    const next = new Set(current);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setter(next);
  };

  const handleSave = async () => {
    setSaving(true); setMsg(null);
    try {
      const r = await api.put('/settings', {
        hidden_sales_departments: Array.from(hiddenSalesDepts),
        hidden_test_count_departments: Array.from(hiddenTestCountDepts),
        hidden_summary_labs: Array.from(hiddenLabs),
        hidden_q1_entities: Array.from(hiddenQ1Entities),
      });
      onSaved(r.data.data);
      setMsg({ type: 'ok', text: '저장되었습니다.' });
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error?.message || '저장 실패' });
    } finally {
      setSaving(false);
    }
  };

  const renderCheckboxList = (items, hiddenSet, setter, emptyMsg) => {
    if (items.length === 0) {
      return <p className="text-sm text-gray-400">{emptyMsg}</p>;
    }
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {items.map(name => {
          const visible = !hiddenSet.has(name);
          return (
            <label
              key={name}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
                visible ? 'border-slate-300 bg-white hover:bg-slate-50' : 'border-gray-200 bg-gray-100 text-gray-400'
              }`}
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={() => toggle(setter, hiddenSet, name)}
                className="w-4 h-4 accent-slate-700"
              />
              {visible ? <Eye size={14} /> : <EyeOff size={14} />}
              <span className="text-sm truncate">{name}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1">대시보드 표시 설정</h2>
        <p className="text-sm text-gray-500">체크 해제된 항목은 대시보드 차트에서 숨겨집니다. (합계·집계에는 계속 반영)</p>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded ${msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.text}
        </div>
      )}

      <section>
        <h3 className="font-semibold text-sm text-slate-700 mb-2">Q1 전사 매출 · 패널 표시 (한피연/얼트루)</h3>
        <p className="text-xs text-gray-500 mb-3">체크된 패널만 Q1 도넛 영역에 표시됩니다. 둘 다 체크 시 좌우 분할, 하나만 체크 시 전체 폭으로 표시됩니다.</p>
        {renderCheckboxList(options.q1Entities, hiddenQ1Entities, setHiddenQ1Entities, '항목 없음')}
      </section>

      <section>
        <h3 className="font-semibold text-sm text-slate-700 mb-2">Q1/Q2 매출 · 부서별 표시</h3>
        <p className="text-xs text-gray-500 mb-3">체크된 부서만 도넛/막대 차트에 개별 표시됩니다. 숨긴 부서의 금액은 전사 목표/누적매출 합계에는 계속 포함됩니다.</p>
        {renderCheckboxList(options.salesDepartments, hiddenSalesDepts, setHiddenSalesDepts, '매출 데이터가 아직 로드되지 않았습니다.')}
      </section>

      <section>
        <h3 className="font-semibold text-sm text-slate-700 mb-2">Q3 일일 시험건수 · 부서별 표시</h3>
        <p className="text-xs text-gray-500 mb-3">체크된 부서만 시험건수 카드에 개별 표시됩니다. 매출 데이터의 부서를 기준으로 합니다.</p>
        {renderCheckboxList(options.salesDepartments, hiddenTestCountDepts, setHiddenTestCountDepts, '매출 데이터가 아직 로드되지 않았습니다.')}
      </section>

      <section>
        <h3 className="font-semibold text-sm text-slate-700 mb-2">Q4 시험대상자 인원수 · 연구소별 표시</h3>
        <p className="text-xs text-gray-500 mb-3">체크된 연구소만 시험대상자 카드에 표시됩니다. 데이터 입력은 숨김 여부와 상관없이 가능합니다.</p>
        {renderCheckboxList(options.labs, hiddenLabs, setHiddenLabs, '연구소 목록 없음')}
      </section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          <Save size={16} /> 저장
        </button>
      </div>
    </div>
  );
}
