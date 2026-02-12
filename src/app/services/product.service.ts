import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Product, ProductImage, ProductImageListResponse, ProductListResponse, ProductSearchResponse, ProductCategoryResponse, ProductBrandResponse } from '../models/product';
import { environment } from '../../environments/environment';
import { ErrorHandlerService } from '../core/error/error-handler.service';
import { NotificationService } from '../core/notification/notification.service';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/products`;
  private readonly errorHandler = inject(ErrorHandlerService);
  private readonly notificationService = inject(NotificationService);

  // Get all products with pagination
  getAllProducts(limit: number = 50, offset: number = 0): Observable<ProductListResponse> {
    return this.http.get<ProductListResponse>(this.apiUrl, {
      params: { limit: limit.toString(), offset: offset.toString() }
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getAllProducts');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Get single product by ID
  getProductById(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.apiUrl}/${id}`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getProductById');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Search products
  searchProducts(query: string, limit: number = 50, offset: number = 0): Observable<ProductSearchResponse> {
    return this.http.get<ProductSearchResponse>(`${this.apiUrl}/search`, {
      params: { q: query, limit: limit.toString(), offset: offset.toString() }
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'searchProducts');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Get products by category
  getProductsByCategory(category: string, limit: number = 50, offset: number = 0): Observable<ProductCategoryResponse> {
    return this.http.get<ProductCategoryResponse>(
      `${this.apiUrl}/category/${encodeURIComponent(category)}`,
      { params: { limit: limit.toString(), offset: offset.toString() } }
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getProductsByCategory');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Get products by brand
  getProductsByBrand(brand: string, limit: number = 50, offset: number = 0): Observable<ProductBrandResponse> {
    return this.http.get<ProductBrandResponse>(
      `${this.apiUrl}/brand/${encodeURIComponent(brand)}`,
      { params: { limit: limit.toString(), offset: offset.toString() } }
    ).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getProductsByBrand');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Get in-stock products only
  getProductsInStock(limit: number = 50, offset: number = 0): Observable<ProductListResponse> {
    return this.http.get<ProductListResponse>(`${this.apiUrl}/in-stock`, {
      params: { limit: limit.toString(), offset: offset.toString() }
    }).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getProductsInStock');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Get all images for a product
  getProductImages(productId: number): Observable<ProductImageListResponse> {
    return this.http.get<ProductImageListResponse>(`${this.apiUrl}/${productId}/images`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getProductImages');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Get main image for a product
  getProductMainImage(productId: number): Observable<ProductImage> {
    return this.http.get<ProductImage>(`${this.apiUrl}/${productId}/main-image`).pipe(
      catchError((error: HttpErrorResponse) => {
        const appError = this.errorHandler.handleError(error, 'getProductMainImage');
        this.notificationService.showError(appError.userMessage);
        return throwError(() => appError);
      })
    );
  }

  // Helper: Extract image name from minio_object_name
  // Example: "products/40121298/image_0.jpg" -> "image_0.jpg"
  getImageName(minioObjectName: string): string {
    const parts = minioObjectName.split('/');
    return parts[parts.length - 1];
  }

  // Helper: Construct direct image URL
  getImageUrl(productId: number, minioObjectName: string): string {
    const imageName = this.getImageName(minioObjectName);
    return `${environment.apiUrl}/products/${productId}/images/${imageName}`;
  }

  // Helper: Find main image from product
  getMainImage(product: Product): ProductImage | undefined {
    if (!product || !product.images || !Array.isArray(product.images)) {
      return undefined;
    }
    return product.images.find(img => img.is_main);
  }

  // Helper: Calculate discount percentage
  calculateDiscountPercentage(initialPrice: number, finalPrice: number): number {
    if (initialPrice <= 0 || finalPrice >= initialPrice) return 0;
    return Math.round(((initialPrice - finalPrice) / initialPrice) * 100);
  }

  // Helper: Parse all_available_sizes JSON string
  parseAvailableSizes(sizesJson: string | null | undefined): string[] {
    if (!sizesJson) {
      return [];
    }
    try {
      const parsed = JSON.parse(sizesJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
