import React, { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Copy, Check, Settings, Image as ImageIcon, Loader2, Search } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import config from './config.json';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  type: string;
  url: string | null;
}

const App: React.FC = () => {
  const [workerUrl, setWorkerUrl] = useState(() => {
    const raw = config.WORKER_URL || localStorage.getItem('worker_url') || '';
    return raw.replace(/\/+$/, '');
  });
  const [authSecret, setAuthSecret] = useState(localStorage.getItem('auth_secret') || '');
  const [isConfigOpen, setIsConfigOpen] = useState(!workerUrl || !authSecret);
  const [files, setFiles] = useState<GitHubFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCDN, setSelectedCDN] = useState<string>(config.DEFAULT_CDN || 'jsDelivr');

  const cdnProviders: Record<string, (repo: string, branch: string, path: string) => string> = {
    'jsDelivr': (repo, branch, path) => `https://cdn.jsdelivr.net/gh/${repo}@${branch}/${path}`,
    'jsDelivr-Fastly': (repo, branch, path) => `https://fastly.jsdelivr.net/gh/${repo}@${branch}/${path}`,
    'jsDelivr-GCore': (repo, branch, path) => `https://gcore.jsdelivr.net/gh/${repo}@${branch}/${path}`,
    'Staticaly': (repo, branch, path) => `https://cdn.staticaly.com/gh/${repo}/${branch}/${path}`,
    'GitMirror': (repo, branch, path) => `https://cdn.gitmirror.com/gh/${repo}@${branch}/${path}`,
    'GitHack': (repo, branch, path) => `https://raw.githack.com/${repo}/${branch}/${path}`,
    'GitHub-Proxy': (repo, branch, path) => `https://ghproxy.com/https://raw.githubusercontent.com/${repo}/${branch}/${path}`,
    'GitHub': (repo, branch, path) => `https://raw.githubusercontent.com/${repo}/${branch}/${path}`,
  };

  const getCDNUrl = useCallback((path: string) => {
    return cdnProviders[selectedCDN](config.GITHUB_REPO, config.GITHUB_BRANCH, path);
  }, [selectedCDN]);

  const fetchFiles = useCallback(async () => {
    if (!workerUrl || !authSecret) return;
    setLoading(true);
    try {
      const response = await fetch(`${workerUrl}/list`, {
        headers: { 'X-Auth-Secret': authSecret }
      });
      if (response.ok) {
        const data = await response.json();
        setFiles(data.filter((f: GitHubFile) => f.type === 'file'));
      } else {
        console.error('Failed to fetch files');
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  }, [workerUrl, authSecret]);

  useEffect(() => {
    if (workerUrl && authSecret) {
      fetchFiles();
    }
  }, [workerUrl, authSecret, fetchFiles]);

  const saveConfig = () => {
    const cleanUrl = workerUrl.replace(/\/+$/, '');
    localStorage.setItem('worker_url', cleanUrl);
    localStorage.setItem('auth_secret', authSecret);
    setWorkerUrl(cleanUrl);
    setIsConfigOpen(false);
    fetchFiles();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !workerUrl || !authSecret) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${workerUrl}/upload`, {
        method: 'POST',
        headers: { 'X-Auth-Secret': authSecret },
        body: formData
      });
      if (response.ok) {
        await fetchFiles();
      } else {
        const err = await response.json();
        alert(`上传失败: ${err.error || err.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (path: string, sha: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    if (!workerUrl || !authSecret) return;

    try {
      const response = await fetch(`${workerUrl}/delete?path=${encodeURIComponent(path)}&sha=${sha}`, {
        method: 'DELETE',
        headers: { 'X-Auth-Secret': authSecret }
      });
      if (response.ok) {
        setFiles(files.filter(f => f.sha !== sha));
      } else {
        alert('Delete failed');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed');
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredFiles = files.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <ImageIcon className="text-blue-500" />
              GitHub 图床
            </h1>
            <p className="text-gray-500 dark:text-gray-400">使用 Cloudflare + GitHub + CDN 构建</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 shadow-sm">
              {Object.keys(cdnProviders).map((name) => (
                <button
                  key={name}
                  onClick={() => setSelectedCDN(name)}
                  className={cn(
                    "px-3 py-1 text-sm font-medium rounded-md transition-all",
                    selectedCDN === name 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <Settings size={20} />
            </button>
            <label className={cn(
              "flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors shadow-md",
              uploading && "opacity-70 cursor-not-allowed"
            )}>
              {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
              <span>{uploading ? '上传中...' : '上传图片'}</span>
              <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} accept="image/*" />
            </label>
          </div>
        </header>

        {isConfigOpen && (
          <div className="mb-8 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg">
            <h2 className="text-xl font-semibold mb-4">配置设置</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Worker URL</label>
                <input 
                  type="text" 
                  value={workerUrl} 
                  onChange={(e) => setWorkerUrl(e.target.value)}
                  placeholder="https://your-worker.workers.dev"
                  className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Auth Secret</label>
                <input 
                  type="password" 
                  value={authSecret} 
                  onChange={(e) => setAuthSecret(e.target.value)}
                  placeholder="Your AUTH_SECRET"
                  className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-transparent"
                />
              </div>
            </div>
            <button 
              onClick={saveConfig}
              className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
            >
              保存配置
            </button>
          </div>
        )}

        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="搜索图片..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500">
            <Loader2 className="animate-spin mb-4" size={48} />
            <p>加载中...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredFiles.map((file, index) => {
              const displayUrl = getCDNUrl(file.path);
              return (
                <div key={file.sha} className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                  <div className="aspect-video bg-gray-100 dark:bg-gray-900 relative">
                    <img 
                      src={displayUrl} 
                      alt={file.name} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button 
                        onClick={() => copyToClipboard(displayUrl, index)}
                        className="p-2 bg-white text-gray-900 rounded-full hover:scale-110 transition-transform"
                        title="复制链接"
                      >
                        {copiedIndex === index ? <Check size={20} className="text-green-600" /> : <Copy size={20} />}
                      </button>
                      <button 
                        onClick={() => handleDelete(file.path, file.sha)}
                        className="p-2 bg-red-600 text-white rounded-full hover:scale-110 transition-transform"
                        title="删除图片"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium truncate mb-1" title={file.name}>{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
              );
            })}
            {filteredFiles.length === 0 && (
              <div className="col-span-full py-20 text-center text-gray-500">
                <p className="text-lg">暂无图片</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
