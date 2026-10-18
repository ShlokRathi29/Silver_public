import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Creator, Product } from './types';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import './style.css';

const PAGE_SIZE = 20;
const SEARCH_LIMIT = 12;
type PageState = 'loading' | 'ready' | 'error' | 'unconfigured' | 'missing';
type CreatorGear = { product_id: string; products: { id: string; name: string; slug: string } | null };
type PageResult<T> = { rows: T[]; total: number };

function escapeLikeTerm(value: string) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function usePageMetadata(title: string, description: string, canonicalPath?: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'description'; document.head.append(meta); }
    meta.content = description;
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const siteUrl = import.meta.env.VITE_SITE_URL?.trim();
    if (siteUrl && canonicalPath) {
      try {
        const origin = new URL(siteUrl);
        if (origin.protocol !== 'https:' && origin.protocol !== 'http:') throw new Error('Unsupported canonical URL protocol');
        if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
        canonical.href = new URL(canonicalPath, origin.origin).href;
      } catch { canonical?.remove(); }
    } else canonical?.remove();
  }, [title, description, canonicalPath]);
}

function useStructuredData(id: string, data: Record<string, unknown> | null) {
  useEffect(() => {
    const existing = document.getElementById(id);
    existing?.remove();
    if (!data) return;
    const script = document.createElement('script');
    script.id = id;
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data).replaceAll('<', '\\u003c');
    document.head.append(script);
    return () => script.remove();
  }, [id, data]);
}

function SiteHeader() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };
  return <header><Link className="brand" to="/">CreatorGear<span>.</span></Link><nav aria-label="Main navigation"><NavLink to="/creators">Creators</NavLink><NavLink to="/products">Gear</NavLink><form className="header-search" onSubmit={submit}><label className="sr-only" htmlFor="site-search">Search creators and gear</label><input id="site-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search creators & gear"/><button type="submit" aria-label="Submit search">Search</button></form></nav></header>;
}

function Home() {
  usePageMetadata('CreatorGear — Discover creator gear', 'Discover the gear used by creators.', '/');
  return <main id="main-content" className="hero"><p className="eyebrow">CREATORGEAR DIRECTORY</p><h1>Discover the gear behind the creators you follow.</h1><p>Explore creator setups and the products they use.</p><div className="actions"><Link className="button" to="/creators">Browse creators</Link><Link className="button secondary" to="/products">Explore gear</Link></div></main>;
}

function Directory<T extends { id: string; slug: string; name: string }>({ title, path, load, render }: { title: string; path: string; load: (query: string, page: number) => Promise<PageResult<T>>; render: (item: T) => ReactNode }) {
  const [result, setResult] = useState<PageResult<T>>({ rows: [], total: 0 });
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<PageState>('loading');
  usePageMetadata(`${title} | CreatorGear`, `Browse and search published ${title.toLowerCase()} on CreatorGear.`, path);
  useEffect(() => {
    let alive = true;
    if (!isSupabaseConfigured || !supabase) { setState('unconfigured'); return () => { alive = false; }; }
    setState('loading');
    load(query.trim(), page).then((data) => { if (alive) { setResult(data); setState('ready'); } }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [query, page, load]);
  const pageCount = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  return <main id="main-content" className="content"><p className="eyebrow">THE DIRECTORY</p><h1>{title}</h1><label className="search">Search {title.toLowerCase()}<input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={`Search ${title.toLowerCase()}…`} /></label><LoadState state={state} />{state === 'ready' && (result.rows.length ? <><div className="grid" aria-live="polite">{result.rows.map((item) => <article className="card" key={item.id}>{render(item)}</article>)}</div><Pagination page={page} pageCount={pageCount} total={result.total} onChange={setPage}/></> : <p>No published listings found.</p>)}</main>;
}

function Pagination({ page, pageCount, total, onChange }: { page: number; pageCount: number; total: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return <p className="result-count">{total} {total === 1 ? 'result' : 'results'}</p>;
  return <nav className="pagination" aria-label="Directory pages"><span className="result-count">Page {page} of {pageCount} · {total} results</span><div><button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}>Previous</button><button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount}>Next</button></div></nav>;
}

function LoadState({ state }: { state: PageState }) {
  if (state === 'loading') return <p role="status">Loading…</p>;
  if (state === 'unconfigured') return <p className="notice">Connect Supabase to load published listings. Set the variables in <code>.env.local</code>.</p>;
  if (state === 'error') return <p className="notice" role="alert">This listing could not be loaded. Check public database access and try again.</p>;
  if (state === 'missing') return <p>No published listing was found.</p>;
  return null;
}

const loadCreators = async (query: string, page: number): Promise<PageResult<Creator>> => {
  if (!supabase) return { rows: [], total: 0 };
  let request = supabase.from('creators').select('id,name,slug,bio,country_name,follower_count', { count: 'exact' }).eq('status', 'published').order('name');
  if (query) request = request.ilike('name', `%${escapeLikeTerm(query)}%`);
  const { data, error, count } = await request.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as Creator[], total: count ?? 0 };
};
const loadProducts = async (query: string, page: number): Promise<PageResult<Product>> => {
  if (!supabase) return { rows: [], total: 0 };
  let request = supabase.from('products').select('id,name,slug,description,image_url,product_types(name)', { count: 'exact' }).eq('status', 'published').order('name');
  if (query) request = request.ilike('name', `%${escapeLikeTerm(query)}%`);
  const { data, error, count } = await request.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as Product[], total: count ?? 0 };
};

function CrossSearch() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [state, setState] = useState<PageState>('ready');
  usePageMetadata(query ? `Search: ${query} | CreatorGear` : 'Search | CreatorGear', 'Search published creators and gear on CreatorGear.', '/search');
  useEffect(() => setInput(query), [query]);
  useEffect(() => {
    let alive = true;
    if (!query.trim()) { setCreators([]); setProducts([]); setState('ready'); return () => { alive = false; }; }
    if (!isSupabaseConfigured || !supabase) { setState('unconfigured'); return () => { alive = false; }; }
    setState('loading');
    Promise.all([loadSearchCreators(query.trim()), loadSearchProducts(query.trim())]).then(([creatorRows, productRows]) => {
      if (alive) { setCreators(creatorRows); setProducts(productRows); setState('ready'); }
    }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, [query]);
  const submit = (event: FormEvent) => { event.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}); };
  return <main id="main-content" className="content"><p className="eyebrow">DISCOVERY</p><h1>Search creators and gear</h1><form className="search search-form" onSubmit={submit}><label htmlFor="cross-search">Search all listings</label><div><input id="cross-search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Try a creator or product name"/><button type="submit">Search</button></div></form>{!query.trim() && <p>Search across published creators and products.</p>}<LoadState state={state}/>{state === 'ready' && query.trim() && <div aria-live="polite">{creators.length === 0 && products.length === 0 ? <p>No published matches for “{query}”.</p> : <><SearchGroup title="Creators" count={creators.length} max={SEARCH_LIMIT}>{creators.map((creator) => <article className="card" key={creator.id}><Link to={`/creators/${creator.slug}`}><h3>{creator.name}</h3></Link>{creator.country_name && <p>{creator.country_name}</p>}</article>)}</SearchGroup><SearchGroup title="Gear" count={products.length} max={SEARCH_LIMIT}>{products.map((product) => <article className="card" key={product.id}><Link to={`/products/${product.slug}`}><h3>{product.name}</h3></Link>{product.product_types?.name && <p>{product.product_types.name}</p>}</article>)}</SearchGroup></>}</div>}</main>;
}
function SearchGroup({ title, count, max, children }: { title: string; count: number; max: number; children: ReactNode }) {
  if (!count) return null;
  return <section className="related"><h2>{title}</h2><div className="grid">{children}</div>{count === max && <p className="result-count">Showing up to {max} matches.</p>}</section>;
}
const loadSearchCreators = async (query: string) => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('creators').select('id,name,slug,country_name').eq('status', 'published').ilike('name', `%${escapeLikeTerm(query)}%`).order('name').limit(SEARCH_LIMIT);
  if (error) throw error;
  return (data ?? []) as Creator[];
};
const loadSearchProducts = async (query: string) => {
  if (!supabase) return [];
  const { data, error } = await supabase.from('products').select('id,name,slug,product_types(name)').eq('status', 'published').ilike('name', `%${escapeLikeTerm(query)}%`).order('name').limit(SEARCH_LIMIT);
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
  usePageMetadata(creator ? `${creator.name} | CreatorGear` : 'Creator profile | CreatorGear', creator?.bio || 'Discover the gear used by this creator.', creator ? `/creators/${creator.slug}` : undefined);
  useStructuredData('creator-structured-data', creator ? {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: creator.name,
    ...(creator.bio ? { description: creator.bio } : {}),
  } : null);
  useEffect(() => {
    let alive = true;
    if (!creator || !supabase) return () => { alive = false; };
    setGearState('loading');
    loadCreatorGear(creator.id).then((rows) => { if (alive) { setGear(rows); setGearState('ready'); } }).catch(() => { if (alive) setGearState('error'); });
    return () => { alive = false; };
  }, [creator]);
  return <main id="main-content" className="content"><Link className="back-link" to="/creators">← All creators</Link><LoadState state={state} />{state === 'ready' && creator && <><p className="eyebrow">CREATOR PROFILE</p><h1>{creator.name}</h1>{creator.country_name && <p className="detail-meta">{creator.country_name}</p>}{creator.follower_count != null && <p className="detail-meta">{creator.follower_count.toLocaleString()} followers</p>}{creator.bio && <p className="detail-copy">{creator.bio}</p>}<section className="related"><h2>Gear used</h2>{gearState === 'loading' && <p>Loading gear…</p>}{gearState === 'error' && <p className="notice">Gear could not be loaded.</p>}{gearState === 'ready' && (gear.length ? <div className="grid">{gear.map((row) => row.products && <article className="card" key={row.product_id}><Link to={`/products/${row.products.slug}`}><h3>{row.products.name}</h3></Link></article>)}</div> : <p>No published gear is listed for this creator.</p>)}</section></>}</main>;
}

function ProductDetail() {
  const { record: product, state } = usePublicRecord(loadProduct);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [creatorsState, setCreatorsState] = useState<PageState>('loading');
  usePageMetadata(product ? `${product.name} | CreatorGear` : 'Gear details | CreatorGear', product?.description || 'Discover creators who use this gear.', product ? `/products/${product.slug}` : undefined);
  useStructuredData('product-structured-data', product ? {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    ...(product.description ? { description: product.description } : {}),
    ...(product.image_url ? { image: product.image_url } : {}),
    ...(product.product_types?.name ? { category: product.product_types.name } : {}),
  } : null);
  useEffect(() => {
    let alive = true;
    if (!product || !supabase) return () => { alive = false; };
    setCreatorsState('loading');
    loadProductCreators(product.id).then((rows) => { if (alive) { setCreators(rows); setCreatorsState('ready'); } }).catch(() => { if (alive) setCreatorsState('error'); });
    return () => { alive = false; };
  }, [product]);
  return <main id="main-content" className="content"><Link className="back-link" to="/products">← All gear</Link><LoadState state={state} />{state === 'ready' && product && <><p className="eyebrow">GEAR DETAILS</p><h1>{product.name}</h1>{product.product_types?.name && <p className="detail-meta">{product.product_types.name}</p>}{product.description && <p className="detail-copy">{product.description}</p>}<section className="related"><h2>Creators using this gear</h2>{creatorsState === 'loading' && <p>Loading creators…</p>}{creatorsState === 'error' && <p className="notice">Creator listings could not be loaded.</p>}{creatorsState === 'ready' && (creators.length ? <div className="grid">{creators.map((creator) => <article className="card" key={creator.id}><Link to={`/creators/${creator.slug}`}><h3>{creator.name}</h3></Link>{creator.country_name && <p>{creator.country_name}</p>}</article>)}</div> : <p>No published creators are listed for this gear.</p>)}</section></>}</main>;
}

function NotFound() {
  usePageMetadata('Page not found | CreatorGear', 'The requested page could not be found.');
  return <main id="main-content" className="content"><h1>Page not found</h1><Link to="/">Return home</Link></main>;
}

export default function App() {
  return <><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader/><Routes><Route path="/" element={<Home />} /><Route path="/search" element={<CrossSearch/>}/><Route path="/creators" element={<Directory title="Creators" path="/creators" load={loadCreators} render={(creator) => <><Link to={`/creators/${creator.slug}`}><h2>{creator.name}</h2></Link>{creator.country_name && <p>{creator.country_name}</p>}{creator.bio && <p>{creator.bio}</p>}</>} />} /><Route path="/creators/:slug" element={<CreatorDetail />} /><Route path="/products" element={<Directory title="Gear" path="/products" load={loadProducts} render={(product) => <><Link to={`/products/${product.slug}`}><h2>{product.name}</h2></Link>{product.product_types?.name && <p>{product.product_types.name}</p>}{product.description && <p>{product.description}</p>}</>} />} /><Route path="/products/:slug" element={<ProductDetail />} /><Route path="*" element={<NotFound/>} /></Routes><footer>CreatorGear · Gear discovery for curious creators</footer></>;
}
