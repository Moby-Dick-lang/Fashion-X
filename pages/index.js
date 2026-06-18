import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Head from 'next/head';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewelry', 'Hats'];

export default function Home() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [wardrobe, setWardrobe] = useState([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('Tops');
  const [uploading, setUploading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [outfitSuggestion, setOutfitSuggestion] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchWardrobe();
  }, [session]);

  async function fetchWardrobe() {
    const { data } = await supabase
      .from('wardrobe_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setWardrobe(data);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthError('');
    if (authMode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setAuthError(error.message);
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setAuthError(error.message);
      else setAuthError('Check your email to confirm your account!');
    }
  }

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    const fileExt = file.name.split('.').pop();
    const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('wardrobe')
      .upload(fileName, file);

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('wardrobe')
      .getPublicUrl(fileName);

    await supabase.from('wardrobe_items').insert({
      user_id: session.user.id,
      image_url: publicUrl,
      category: selectedCategory,
    });

    await fetchWardrobe();
    setUploading(false);
    e.target.value = '';
  }

  async function deleteItem(id, imageUrl) {
    const path = imageUrl.split('/wardrobe/')[1];
    await supabase.storage.from('wardrobe').remove([path]);
    await supabase.from('wardrobe_items').delete().eq('id', id);
    setWardrobe(prev => prev.filter(item => item.id !== id));
  }

  async function getSuggestion() {
    if (wardrobe.length < 2) {
      alert('Add at least 2 items to your wardrobe first!');
      return;
    }
    setSuggesting(true);
    setOutfitSuggestion(null);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wardrobe }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setOutfitSuggestion(data.suggestion);
    } catch (err) {
      alert('Something went wrong. Try again.');
    }
    setSuggesting(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setWardrobe([]);
    setOutfitSuggestion(null);
  }

  const filteredWardrobe = activeCategory === 'All'
    ? wardrobe
    : wardrobe.filter(item => item.category === activeCategory);

  if (loading) return (
    <div className="loader-screen">
      <div className="loader-dot" />
    </div>
  );

  if (!session) return (
    <>
      <Head>
        <title>Fashion X</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="auth-screen">
        <div className="auth-header">
          <h1 className="logo">FASHION X</h1>
          <p className="tagline">Dress your type with what you have.</p>
        </div>
        <form onSubmit={handleAuth} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input"
            required
          />
          {authError && (
            <p className={authError.includes('Check') ? 'success-msg' : 'error-msg'}>
              {authError}
            </p>
          )}
          <button type="submit" className="btn-primary">
            {authMode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthError(''); }}
          >
            {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <Head>
        <title>Fashion X</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="app">
        <header className="app-header">
          <h1 className="logo">FASHION X</h1>
          <button onClick={handleSignOut} className="signout-btn">Sign out</button>
        </header>

        <div className="upload-section">
          <div className="upload-controls">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="category-select"
            >
              {CATEGORIES.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => fileInputRef.current.click()}
              className="btn-upload"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : '+ Add Item'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleUpload}
            style={{ display: 'none' }}
          />
        </div>

        <div className="category-tabs">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`tab ${activeCategory === cat ? 'tab-active' : ''}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {outfitSuggestion && (
          <div className="suggestion-card">
            <p className="suggestion-label">YOUR LOOK</p>
            <p className="suggestion-text">{outfitSuggestion}</p>
            <button onClick={() => setOutfitSuggestion(null)} className="btn-ghost">
              Dismiss
            </button>
          </div>
        )}

        {filteredWardrobe.length === 0 ? (
          <div className="empty-state">
            <p>Your wardrobe is empty.</p>
            <p className="empty-hint">Tap "+ Add Item" to start building your wardrobe.</p>
          </div>
        ) : (
          <div className="wardrobe-grid">
            {filteredWardrobe.map(item => (
              <div key={item.id} className="wardrobe-item">
                <img src={item.image_url} alt={item.category} />
                <span className="item-label">{item.category}</span>
                <button
                  className="delete-btn"
                  onClick={() => deleteItem(item.id, item.image_url)}
                  title="Remove item"
                >×</button>
              </div>
            ))}
          </div>
        )}

        <div className="suggest-section">
          <button
            onClick={getSuggestion}
            className="btn-suggest"
            disabled={suggesting || wardrobe.length < 2}
          >
            {suggesting ? 'Styling your look...' : '✦ Suggest an Outfit'}
          </button>
        </div>
      </div>
    </>
  );
        }
      
