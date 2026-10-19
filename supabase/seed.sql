-- OPTIONAL demo catalogue. These are SAMPLE rows for demonstration only (no images, no reviews).
-- Replace with real products from the admin dashboard (Products -> Add product, with images).
insert into public.products (name, description, category, price, original_price, stock_quantity, specifications) values
('Demo Smartphone X1', 'Sample listing for testing the store.', 'Smartphones', 24999, 29999, 25, '{"Display":"6.5 inch AMOLED","RAM":"8 GB","Storage":"128 GB"}'),
('Demo Laptop Pro 14', 'Sample listing for testing the store.', 'Laptops', 54990, 62990, 12, '{"Processor":"8-core","RAM":"16 GB","Storage":"512 GB SSD"}'),
('Demo Wireless Headphones', 'Sample listing for testing the store.', 'Headphones & Audio', 2499, 3999, 4, '{"Type":"Over-ear","Battery":"30 hours"}'),
('Demo 4K Monitor 27"', 'Sample listing for testing the store.', 'TVs & Monitors', 18999, 18999, 8, '{"Resolution":"3840x2160","Panel":"IPS"}'),
('Demo Smartwatch S2', 'Sample listing for testing the store.', 'Smartwatches', 3999, 5999, 0, '{"Battery":"7 days","Water resistance":"5 ATM"}'),
('Demo USB-C Fast Charger 65W', 'Sample listing for testing the store.', 'Accessories', 1299, 1799, 60, '{"Output":"65 W","Ports":"2x USB-C"}');
