// Product interface matching API specification
export interface Product {
  id: number;
  name: string;
  description: string;
  initial_price: number;
  final_price: number;
  currency: string;
  in_stock: boolean;
  color: string;
  size: string;
  country_code: string;
  image_count: number;
  model_number: string;
  other_attributes: string;
  root_category: string;
  category: string;
  brand: string;
  all_available_sizes: string;
  created_at: string;
  updated_at: string;
  images?: ProductImage[];
}

// ProductImage interface
export interface ProductImage {
  id: number;
  product_id: number;
  minio_object_name: string;
  is_main: boolean;
  image_order: number;
  file_size: number;
  content_type: string;
  created_at: string;
}

// Product images list response (backend returns wrapped response)
export interface ProductImageListResponse {
  count: number;
  images: ProductImage[];
  product_id: number;
}

// Paginated list response
export interface ProductListResponse {
  products: Product[];
  limit: number;
  offset: number;
  count: number;
}

// Search response
export interface ProductSearchResponse extends ProductListResponse {
  query: string;
}

// Category response
export interface ProductCategoryResponse extends ProductListResponse {
  category: string;
}

// Brand response
export interface ProductBrandResponse extends ProductListResponse {
  brand: string;
}

// Filter state interface
export interface ProductFilters {
  category: string | null;
  brand: string | null;
  searchQuery: string | null;
  inStockOnly: boolean;
}

// Sort options
export type SortOption = 
  | 'name_asc' 
  | 'name_desc' 
  | 'price_asc' 
  | 'price_desc' 
  | 'newest';

// Breadcrumb item
export interface BreadcrumbItem {
  label: string;
  url?: string;
  queryParams?: { [key: string]: string };
  active?: boolean;
}
