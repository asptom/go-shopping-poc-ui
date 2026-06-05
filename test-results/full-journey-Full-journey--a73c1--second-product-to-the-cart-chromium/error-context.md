# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: full-journey.spec.ts >> Full journey: auth through order history >> P5.4: adds a second product to the cart
- Location: e2e/specs/full-journey.spec.ts:414:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]').filter({ hasText: 'Item added to cart' }).first()
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]').filter({ hasText: 'Item added to cart' }).first()

```

```yaml
- text: Hello, sign in
- link "Account & Lists":
  - /url: "#"
- link "Returns & Orders":
  - /url: "#"
- link "🇺🇸 EN":
  - /url: "#"
- banner:
  - link "GoShopping":
    - /url: /
  - combobox:
    - option "All"
    - option "Bag Charms"
    - option "Car Replacement Parts"
    - option "Cipher Locks"
    - option "Coin Purses"
    - option "Digital Bags"
    - option "Luggage Sets"
    - option "Make Up Bags"
  - textbox "Search GoShopping"
  - button:
    - img
  - text: Hello, sign in
  - link "Shopping cart":
    - /url: /cart
    - text: 1 Cart
  - navigation:
    - link "All":
      - /url: "#"
    - link "Today's Deals":
      - /url: "#"
    - link "Customer Service":
      - /url: "#"
    - link "Registry":
      - /url: "#"
    - link "Gift Cards":
      - /url: "#"
    - link "Sell":
      - /url: "#"
- main:
  - heading "Products" [level=1]
  - text: Showing 20 of 20 products
  - complementary:
    - heading "Filters" [level=3]
    - heading "Category" [level=4]
    - radio "All Categories" [checked]
    - text: All Categories
    - radio "Bag Charms"
    - text: Bag Charms
    - radio "Car Replacement Parts"
    - text: Car Replacement Parts
    - radio "Cipher Locks"
    - text: Cipher Locks
    - radio "Coin Purses"
    - text: Coin Purses
    - radio "Digital Bags"
    - text: Digital Bags
    - radio "Luggage Sets"
    - text: Luggage Sets
    - radio "Make Up Bags"
    - text: Make Up Bags
    - heading "Brand" [level=4]
    - radio "All Brands" [checked]
    - text: All Brands
    - radio "ROMWE"
    - text: ROMWE
    - radio "SHEIN"
    - text: SHEIN
    - radio "Unbeatablesale"
    - text: Unbeatablesale
    - heading "Availability" [level=4]
    - checkbox "In Stock Only"
    - text: In Stock Only
  - main:
    - text: "Sort by:"
    - combobox "Sort by:":
      - 'option "Name: A to Z" [selected]'
      - 'option "Name: Z to A"'
      - 'option "Price: Low to High"'
      - 'option "Price: High to Low"'
      - option "Newest First"
    - article:
      - img "1pc Creative Cute Cat Shape Pencil Case,Cartoon School Supplies,Plush Large Capacity Stationery Storage Bag, High Appearance Value, Niche Stationery Box For Students,Perfect Gift, Back To School School Supplies(Random Style)"
      - text: "-5%"
      - heading "1pc Creative Cute Cat Shape Pencil Case,Cartoon School Supplies,Plush Large Capacity Stationery Storage Bag, High Appearance Value, Niche Stationery Box For Students,Perfect Gift, Back To School School Supplies(Random Style)" [level=3]
      - text: SHEIN $3.50 $3.70 In Stock
      - button "Add to Cart"
    - article:
      - img "1pc Travel Portable Door Lock, Reliable Safety For Travel And Hotel Stays, Provides Extra Privacy And Security Against Unauthorized Entry For Homes, Hotels, And Apartments Travel Essentials School Back To School School Supplies Holiday Camping Holiday Essentials Vacation Accessories Mini Summer"
      - text: "-5%"
      - button "Quick View"
      - heading "1pc Travel Portable Door Lock, Reliable Safety For Travel And Hotel Stays, Provides Extra Privacy And Security Against Unauthorized Entry For Homes, Hotels, And Apartments Travel Essentials School Back To School School Supplies Holiday Camping Holiday Essentials Vacation Accessories Mini Summer" [level=3]
      - text: SHEIN $3.80 $4.00 In Stock
      - button "Add to Cart"
    - article:
      - img "1set Includes 1pc Black Electronic Organizer Travel Case And 6pcs Silicone Cable Ties, Travel Essentials Bag, Cable, Charging Cable, External Hard Drive, Portable Power Bank (With Random Zipper), Suitable For Headphones, Phone Chargers, Mice, Audio, Computers, Reusable Cable Ties, And Cable Organizers For Home, Office, Kitchen, And School Use"
      - text: "-6%"
      - heading "1set Includes 1pc Black Electronic Organizer Travel Case And 6pcs Silicone Cable Ties, Travel Essentials Bag, Cable, Charging Cable, External Hard Drive, Portable Power Bank (With Random Zipper), Suitable For Headphones, Phone Chargers, Mice, Audio, Computers, Reusable Cable Ties, And Cable Organizers For Home, Office, Kitchen, And School Use" [level=3]
      - text: SHEIN $6.30 $6.70 In Stock
      - button "Add to Cart"
    - article:
      - img "20in Hardside ABS Cabin Suitcase Spinner Travel Luggage Trolley Lightweight Case"
      - text: "-30%"
      - heading "20in Hardside ABS Cabin Suitcase Spinner Travel Luggage Trolley Lightweight Case" [level=3]
      - text: SHEIN $68.99 $98.99 In Stock
      - button "Add to Cart"
    - article:
      - img "Electronics Organizer Travel Case, Carrying Pouch Bag For Travel Essentials, For Cable, Charging Cord, External Hard Drive, Portable Power Bank(Zipper Random) Charger Case For Business,Travel,School,College,Office School Supplies School Accessaries Back To School Universty Students"
      - text: "-6%"
      - heading "Electronics Organizer Travel Case, Carrying Pouch Bag For Travel Essentials, For Cable, Charging Cord, External Hard Drive, Portable Power Bank(Zipper Random) Charger Case For Business,Travel,School,College,Office School Supplies School Accessaries Back To School Universty Students" [level=3]
      - text: SHEIN $6.20 $6.60 In Stock
      - button "Add to Cart"
    - article:
      - img "Electronics Organizer Travel Case, Carrying Pouch Bag For Travel Essentials, For Cable, Charging Cord, External Hard Drive, Portable Power Bank(Zipper Random)Storage Case Cable Bag Digital Bag Charger Case For Business,Travel,School,College,Office School Supplies School Accessaries Back To School Universty Students Organizer"
      - text: "-7%"
      - heading "Electronics Organizer Travel Case, Carrying Pouch Bag For Travel Essentials, For Cable, Charging Cord, External Hard Drive, Portable Power Bank(Zipper Random)Storage Case Cable Bag Digital Bag Charger Case For Business,Travel,School,College,Office School Supplies School Accessaries Back To School Universty Students Organizer" [level=3]
      - text: SHEIN $6.80 $7.30 In Stock
      - button "Add to Cart"
    - article:
      - img "Electronics Organizer Travel Case, Carrying Pouch Bag For Travel Essentials, For Cable, Charging Cord, External Hard Drive, Portable Power Bank(Zipper Random)Storage Case Cable Bag Digital Bag Charger Case For Business,Travel,School,College,Office School Supplies School Accessaries Back To School Universty Students Organizer"
      - text: "-7%"
      - heading "Electronics Organizer Travel Case, Carrying Pouch Bag For Travel Essentials, For Cable, Charging Cord, External Hard Drive, Portable Power Bank(Zipper Random)Storage Case Cable Bag Digital Bag Charger Case For Business,Travel,School,College,Office School Supplies School Accessaries Back To School Universty Students Organizer" [level=3]
      - text: SHEIN $6.70 $7.20 In Stock
      - button "Add to Cart"
    - article:
      - img "Jewelry Box Case,Women's Keychain,Traveling Jewelry Holder Storage, Pill Box Keychain Container,Travel Jewelry Case Organizer Portable Ring Box Container Storage For Women Men Carrying Earrings Necklaces On Trip,Jewelry Box Case, Traveling Jewelry Holder Storage, For Car Keys, Mobile Phones, Cameras, Wallets, ID Cards, Badge Cards, Wristband Keychains,Suitable Gift For Girls, Boys, Men And Women, College, High School And Sports Rings. Anniversary, Birthdays, Christmas, Valentines Day"
      - text: "-8%"
      - heading "Jewelry Box Case,Women's Keychain,Traveling Jewelry Holder Storage, Pill Box Keychain Container,Travel Jewelry Case Organizer Portable Ring Box Container Storage For Women Men Carrying Earrings Necklaces On Trip,Jewelry Box Case, Traveling Jewelry Holder Storage, For Car Keys, Mobile Phones, Cameras, Wallets, ID Cards, Badge Cards, Wristband Keychains,Suitable Gift For Girls, Boys, Men And Women, College, High School And Sports Rings. Anniversary, Birthdays, Christmas, Valentines Day" [level=3]
      - text: SHEIN $2.20 $2.40 In Stock
      - button "Add to Cart"
    - article:
      - img "ROMWE Goth 1pc Unique Purple Pumpkin Bell, Hat, Skeleton Hand, Black Star Woven Rope Bag Charm & Keychain, Suitable For Daily Wear And Holiday Gifts"
      - text: "-7%"
      - heading "ROMWE Goth 1pc Unique Purple Pumpkin Bell, Hat, Skeleton Hand, Black Star Woven Rope Bag Charm & Keychain, Suitable For Daily Wear And Holiday Gifts" [level=3]
      - text: ROMWE $2.70 $2.90 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale 15 In. LH Tie Rod Tube Bent Short Stock Inner"
      - heading "Unbeatablesale 15 In. LH Tie Rod Tube Bent Short Stock Inner" [level=3]
      - text: Unbeatablesale $51.29 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale 21152 Exhaust Header Reducer - 3 To 2.5 In."
      - heading "Unbeatablesale 21152 Exhaust Header Reducer - 3 To 2.5 In." [level=3]
      - text: Unbeatablesale $55.88 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale 215R Alternator Bracket For Small Block Chevy Long Water Pump, Right Hand Mid-Mount"
      - heading "Unbeatablesale 215R Alternator Bracket For Small Block Chevy Long Water Pump, Right Hand Mid-Mount" [level=3]
      - text: Unbeatablesale $73.16 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale 300 Pc. Snap Ring Assortment"
      - heading "Unbeatablesale 300 Pc. Snap Ring Assortment" [level=3]
      - text: Unbeatablesale $32.43 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale Hyperco 185A0850 2.25 In. ID X 5 In. Coil Over Spring - Blue Powdercoated,; 850 Lbs"
      - heading "Unbeatablesale Hyperco 185A0850 2.25 In. ID X 5 In. Coil Over Spring - Blue Powdercoated,; 850 Lbs" [level=3]
      - text: Unbeatablesale $107.64 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale K-Source KSI81850 Snap & Zap Towing Mirror Extension Set With Storage Bag"
      - heading "Unbeatablesale K-Source KSI81850 Snap & Zap Towing Mirror Extension Set With Storage Bag" [level=3]
      - text: Unbeatablesale $81.64 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale K6145T Front Non-Adjustable Lower Press-In Type Ball Joint For 1970-2002 Chevrolet Camaro"
      - heading "Unbeatablesale K6145T Front Non-Adjustable Lower Press-In Type Ball Joint For 1970-2002 Chevrolet Camaro" [level=3]
      - text: Unbeatablesale $41.83 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale PAC Racing Springs PACPAC-R363 Valve Spring Retainers - C-M Steel - 7 Deg"
      - heading "Unbeatablesale PAC Racing Springs PACPAC-R363 Valve Spring Retainers - C-M Steel - 7 Deg" [level=3]
      - text: Unbeatablesale $104.35 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale Taiwan Fu Hsing Industrial 221752 Tru-Guard Castle Electronic Deadbolt Lock, Polished Brass"
      - heading "Unbeatablesale Taiwan Fu Hsing Industrial 221752 Tru-Guard Castle Electronic Deadbolt Lock, Polished Brass" [level=3]
      - text: Unbeatablesale $71.13 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale Tapestry Coin Purse With Clasp - Cat"
      - heading "Unbeatablesale Tapestry Coin Purse With Clasp - Cat" [level=3]
      - text: Unbeatablesale $18.25 In Stock
      - button "Add to Cart"
    - article:
      - img "Unbeatablesale TRANSDAPT 9064 Oil Drain Plug"
      - heading "Unbeatablesale TRANSDAPT 9064 Oil Drain Plug" [level=3]
      - text: Unbeatablesale $27.82 In Stock
      - button "Add to Cart"
    - button "Load More Products"
- link "Back to top":
  - /url: "#top"
- contentinfo:
  - heading "Get to Know Us" [level=3]
  - list:
    - listitem:
      - link "Careers":
        - /url: "#"
    - listitem:
      - link "Blog":
        - /url: "#"
    - listitem:
      - link "About GoShopping":
        - /url: "#"
    - listitem:
      - link "Investor Relations":
        - /url: "#"
    - listitem:
      - link "GoShopping Devices":
        - /url: "#"
    - listitem:
      - link "GoShopping Science":
        - /url: "#"
  - heading "Make Money with Us" [level=3]
  - list:
    - listitem:
      - link "Sell products on GoShopping":
        - /url: "#"
    - listitem:
      - link "Sell on GoShopping Business":
        - /url: "#"
    - listitem:
      - link "Sell apps on GoShopping":
        - /url: "#"
    - listitem:
      - link "Become an Affiliate":
        - /url: "#"
    - listitem:
      - link "Advertise Your Products":
        - /url: "#"
    - listitem:
      - link "Self-Publish with Us":
        - /url: "#"
  - heading "GoShopping Payment Products" [level=3]
  - list:
    - listitem:
      - link "GoShopping Business Card":
        - /url: "#"
    - listitem:
      - link "Shop with Points":
        - /url: "#"
    - listitem:
      - link "Reload Your Balance":
        - /url: "#"
    - listitem:
      - link "GoShopping Currency Converter":
        - /url: "#"
  - heading "Let Us Help You" [level=3]
  - list:
    - listitem:
      - link "GoShopping and COVID-19":
        - /url: "#"
    - listitem:
      - link "Your Account":
        - /url: "#"
    - listitem:
      - link "Your Orders":
        - /url: "#"
    - listitem:
      - link "Shipping Rates & Policies":
        - /url: "#"
    - listitem:
      - link "Returns & Replacements":
        - /url: "#"
    - listitem:
      - link "Manage Your Content and Devices":
        - /url: "#"
    - listitem:
      - link "GoShopping Assistant":
        - /url: "#"
    - listitem:
      - link "Help":
        - /url: "#"
  - link "GoShopping":
    - /url: /
  - button "English":
    - img
    - text: English
  - button "$ USD - U.S. Dollar":
    - img
    - text: $ USD - U.S. Dollar
  - button "🇺🇸 United States":
    - img
    - text: 🇺🇸 United States
- link "Conditions of Use":
  - /url: "#"
- link "Privacy Notice":
  - /url: "#"
- link "Your Ads Privacy Choices":
  - /url: "#"
- paragraph: © 1996-2024, GoShopping.com, Inc. or its affiliates
```

# Test source

```ts
  1  | import { Page, expect } from '@playwright/test';
  2  | 
  3  | export async function expectSuccessNotification(
  4  |   page: Page,
  5  |   text: string | RegExp,
  6  |   timeoutMs = 10_000,
  7  | ): Promise<void> {
  8  |   const notification = page
  9  |     .locator('[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]')
  10 |     .filter({ hasText: text })
  11 |     .first();
> 12 |   await expect(notification).toBeVisible({ timeout: timeoutMs });
     |                              ^ Error: expect(locator).toBeVisible() failed
  13 | }
  14 | 
  15 | export async function waitForNotificationToDismiss(
  16 |   page: Page,
  17 |   text: string | RegExp,
  18 |   timeoutMs = 10_000,
  19 | ): Promise<void> {
  20 |   const notification = page
  21 |     .locator('[data-testid="notification"][class*="notification-success"] [data-testid="notification-message"]')
  22 |     .filter({ hasText: text })
  23 |     .first();
  24 |   await expect(notification).not.toBeVisible({ timeout: timeoutMs });
  25 | }
  26 | 
```