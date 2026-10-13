export type Creator = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  country_name: string | null;
  follower_count: number | null;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  product_types: { name: string } | null;
};
