import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom';
import type { Creator, Product } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import './style.css';

type PageState = 'loading' | 'ready' | 'error' | 'unconfigured' | 'missing';
type CreatorGear = { product_id: string; products: { id: string; name: string; slug: string } | null };

function Home() {
  return <main className="hero"><p className="eyebrow">CREATORGEAR DIRECTORY</p><h1>Discover the gear behind the creators you follow.</h1><p>Explore creator setups and the products they use.</p><div className="actions"><Link className="button" to="/creators">Browse creators</Link><Link className="button secondary" to="/products">Explore gear</Link></div></main>;
}

function Directory<T extends { id: string; slug: string; name: string }>({ title, load, render }: { title: string; load: (query: string) => Promise<T[]>; render: (item: T) => ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const [query, setQuery] = useState('');
  const [state, setState] = useState<PageState>('loading');
  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured || !supabase) { setState('unconfigured'); return () => { alive = false; }; }
    setState('loading');
    load(query.trim()).then((data) => { if (alive) { setItems(data); setState('ready'); } }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [query, load]);
  return <main className="content"><p className="eyebrow">THE DIRECTORY</p><h1>{title}</h1><label className="search">Search {title.toLowerCase()}<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${title.toLowerCase()}…`} /></label><LoadState state={state} />{state === 'ready' && (items.length ? <div className="grid">{items.map((item) => <article className="card" key={item.id}>{render(item)}</article>)}</div> : <p>No published listings found.</p>)}</main>;
}

function LoadState({ state }: { state: PageState }) {
  if (state === 'loading') return <p role="status">Loading…</p>;
  if (state === 'unconfigured') return <p className="notice">Connect Supabase to load published listings. Set the variables in <code>.env.local</code>.</p>;
  if (state === 'error') return <p className="notice" role="alert">This listing could not be loaded. Check public database access and try again.</p>;
  if (state === 'missing') return <p>No published listing was found.</p>;
  return null;
}

const loadCreators = async (query: string) => {
  if (!supabase) return [];
  let request = supabase.from('creators').select('id,name,slug,bio,country_name,follower_count').eq('status', 'published').order('name').limit(60);
  if (query) request = request.ilike('name', `%${query}%`);
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as Creator[];
};
const loadProducts = async (query: string) => {
  if (!supabase) return [];
  let request = supabase.from('products').select('id,name,slug,description,image_url,product_types(name)').eq('status', 'published').order('name').limit(60);
  if (query) request = request.ilike('name', `%${query}%`);
  const { data, error } = await request;
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
};

function usePublicRecord<T>(load: (slug: string) => Promise<T | null>) {
  const { slug = '' } = useParams();
  const [record, setRecord] = useState<T | null>(null);
  const [state, setState] = useState<PageState>('loading');
  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured || !supabase) { setState('unconfigured'); return () => { alive = false; }; }
    setState('loading');
    load(slug).then((value) => { if (alive) { setRecord(value); setState(value ? 'ready' : 'missing'); } }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [slug, load]);
  return { record, state };
}

const loadCreator = async (slug: string): Promise<Creator | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('creators').select('id,name,slug,bio,country_name,follower_count').eq('slug', slug).eq('status', 'published').maybeSingle();
  if (error) throw error;
  return data as Creator | null;
};
const loadCreatorGear = async (creatorId: string): Promise<CreatorGear[]> => {
  if (!supabase) return [];
  const { data: associations, error: associationError } = await supabase.from('creator_gear').select('product_id').eq('creator_id', creatorId).eq('status', 'active');
  if (associationError) throw associationError;
  const productIds = [...new Set((associations ?? []).map((row) => row.product_id as string))];
  if (!productIds.length) return [];
  const { data: products, error: productError } = await supabase.from('products').select('id,name,slug').in('id', productIds).eq('status', 'published').order('name');
  if (productError) throw productError;
  return (products ?? []).map((product) => ({ product_id: product.id, products: product }));
};
const loadProduct = async (slug: string): Promise<Product | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase.from('products').select('id,name,slug,description,image_url,product_type_id,product_types(name)').eq('slug', slug).eq('status', 'published').maybeSingle();
  if (error) throw error;
  return data as unknown as Product | null;
};
const loadProductCreators = async (productId: string): Promise<Creator[]> => {
  if (!supabase) return [];
  const { data: gear, error: gearError } = await supabase.from('creator_gear').select('creator_id').eq('product_id', productId).eq('status', 'active');
  if (gearError) throw gearError;
  const ids = [...new Set((gear ?? []).map((row) => row.creator_id as string))];
  if (!ids.length) return [];
  const { data, error } = await supabase.from('creators').select('id,name,slug,bio,country_name,follower_count').in('id', ids).eq('status', 'published').order('name');
  if (error) throw error;
  return (data ?? []) as Creator[];
};

function CreatorDetail() {
  const { record: creator, state } = usePublicRecord(loadCreator);
  const [gear, setGear] = useState<CreatorGear[]>([]);
  const [gearState, setGearState] = useState<PageState>('loading');
  useEffect(() => {
    let alive = true;
    if (!creator || !supabase) return () => { alive = false; };
    setGearState('loading');
    loadCreatorGear(creator.id).then((rows) => { if (alive) { setGear(rows); setGearState('ready'); } }).catch(() => { if (alive) setGearState('error'); });
    return () => { alive = false; };
  }, [creator]);
  return <main className="content"><Link className="back-link" to="/creators">← All creators</Link><LoadState state={state} />{state === 'ready' && creator && <><p className="eyebrow">CREATOR PROFILE</p><h1>{creator.name}</h1>{creator.country_name && <p className="detail-meta">{creator.country_name}</p>}{creator.follower_count != null && <p className="detail-meta">{creator.follower_count.toLocaleString()} followers</p>}{creator.bio && <p className="detail-copy">{creator.bio}</p>}<section className="related"><h2>Gear used</h2>{gearState === 'loading' && <p>Loading gear…</p>}{gearState === 'error' && <p className="notice">Gear could not be loaded.</p>}{gearState === 'ready' && (gear.length ? <div className="grid">{gear.map((row) => row.products && <article className="card" key={row.product_id}><Link to={`/products/${row.products.slug}`}><h3>{row.products.name}</h3></Link></article>)}</div> : <p>No published gear is listed for this creator.</p>)}</section></>}</main>;
}

function ProductDetail() {
  const { record: product, state } = usePublicRecord(loadProduct);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [creatorsState, setCreatorsState] = useState<PageState>('loading');
  useEffect(() => {
    let alive = true;
    if (!product || !supabase) return () => { alive = false; };
    setCreatorsState('loading');
    loadProductCreators(product.id).then((rows) => { if (alive) { setCreators(rows); setCreatorsState('ready'); } }).catch(() => { if (alive) setCreatorsState('error'); });
    return () => { alive = false; };
  }, [product]);
  return <main className="content"><Link className="back-link" to="/products">← All gear</Link><LoadState state={state} />{state === 'ready' && product && <><p className="eyebrow">GEAR DETAILS</p><h1>{product.name}</h1>{product.product_types?.name && <p className="detail-meta">{product.product_types.name}</p>}{product.description && <p className="detail-copy">{product.description}</p>}<section className="related"><h2>Creators using this gear</h2>{creatorsState === 'loading' && <p>Loading creators…</p>}{creatorsState === 'error' && <p className="notice">Creator listings could not be loaded.</p>}{creatorsState === 'ready' && (creators.length ? <div className="grid">{creators.map((creator) => <article className="card" key={creator.id}><Link to={`/creators/${creator.slug}`}><h3>{creator.name}</h3></Link>{creator.country_name && <p>{creator.country_name}</p>}</article>)}</div> : <p>No published creators are listed for this gear.</p>)}</section></>}</main>;
}

export default function App() {
  return <><header><Link className="brand" to="/">CreatorGear<span>.</span></Link><nav><NavLink to="/creators">Creators</NavLink><NavLink to="/products">Gear</NavLink></nav></header><Routes><Route path="/" element={<Home />} /><Route path="/creators" element={<Directory title="Creators" load={loadCreators} render={(creator) => <><Link to={`/creators/${creator.slug}`}><h2>{creator.name}</h2></Link>{creator.country_name && <p>{creator.country_name}</p>}{creator.bio && <p>{creator.bio}</p>}</>} />} /><Route path="/creators/:slug" element={<CreatorDetail />} /><Route path="/products" element={<Directory title="Gear" load={loadProducts} render={(product) => <><Link to={`/products/${product.slug}`}><h2>{product.name}</h2></Link>{product.product_types?.name && <p>{product.product_types.name}</p>}{product.description && <p>{product.description}</p>}</>} />} /><Route path="/products/:slug" element={<ProductDetail />} /><Route path="*" element={<main className="content"><h1>Page not found</h1><Link to="/">Return home</Link></main>} /></Routes><footer>CreatorGear · Gear discovery for curious creators</footer></>;
}

