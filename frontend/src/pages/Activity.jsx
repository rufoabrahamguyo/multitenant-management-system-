import { useEffect, useState } from 'react';
import { ACTION_LABELS } from '../constants/activityLabels';
import { unwrapList } from '../utils/apiHelpers';
import api from '../api/client';

export default function Activity() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    api.get('/auth/activity/').then(({ data }) => setLogs(unwrapList(data)));
  }, []);

  return (
    <div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-100">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between py-4 px-6 gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {ACTION_LABELS[log.action] || log.action}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {log.user} · {log.detail || log.target || '-'}
                </p>
              </div>
              <span className="text-xs text-slate-400 whitespace-nowrap">
                {new Date(log.created_at).toLocaleString()}
              </span>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">No activity recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
