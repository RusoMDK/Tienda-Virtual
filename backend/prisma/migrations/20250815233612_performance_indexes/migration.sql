-- CreateIndex
CREATE INDEX "Category_name_idx" ON "public"."Category"("name");

-- CreateIndex
CREATE INDEX "Order_userId_createdAt_idx" ON "public"."Order"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "public"."Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "public"."OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "public"."OrderItem"("productId");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "public"."Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_active_createdAt_idx" ON "public"."Product"("active", "createdAt");

-- CreateIndex
CREATE INDEX "Product_active_price_idx" ON "public"."Product"("active", "price");

-- CreateIndex
CREATE INDEX "Product_categoryId_active_createdAt_idx" ON "public"."Product"("categoryId", "active", "createdAt");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revoked_idx" ON "public"."RefreshToken"("userId", "revoked");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "public"."User"("role");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");
