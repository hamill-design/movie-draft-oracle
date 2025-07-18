
# Google AdSense Setup Guide

## Overview
This guide will help you set up Google AdSense for your Movie Draft Oracle application to start earning revenue from ads.

## Prerequisites
- A Google account
- A published website (your Movie Draft Oracle app)
- Compliance with Google AdSense policies

## Step 1: Create Google AdSense Account

1. Go to [Google AdSense](https://www.google.com/adsense/)
2. Click "Get started"
3. Enter your website URL and country
4. Choose whether you want to receive performance suggestions
5. Verify your phone number and address

## Step 2: Add Your Site

1. In your AdSense dashboard, click "Sites"
2. Click "Add site"
3. Enter your website URL
4. Follow the verification process

## Step 3: Get Your Publisher ID

1. In your AdSense dashboard, go to "Account" → "Account information"
2. Copy your Publisher ID (starts with `ca-pub-`)
3. Update the following files with your Publisher ID:

### Files to Update:

#### 1. `index.html`
Replace `ca-pub-XXXXXXXXXX` with your actual Publisher ID in the AdSense script tag.

#### 2. `src/components/ads/AdUnit.tsx`
Replace `ca-pub-XXXXXXXXXX` with your actual Publisher ID in the `data-ad-client` attribute.

#### 3. `src/config/ads.ts`
Replace `ca-pub-XXXXXXXXXX` with your actual Publisher ID in the `publisherId` field.

## Step 4: Create Ad Units

1. In your AdSense dashboard, go to "Ads" → "By ad unit"
2. Create the following ad units:

### Banner Ad (728x90)
- Name: "Header Banner"
- Ad size: 728x90 (Leaderboard)
- Copy the Ad slot ID and update `adSlots.banner` in `src/config/ads.ts`

### Mobile Banner (320x50)
- Name: "Mobile Banner"
- Ad size: 320x50 (Mobile Banner)
- Copy the Ad slot ID and update `adSlots.bannerMobile` in `src/config/ads.ts`

### Sidebar Ad (300x250)
- Name: "Sidebar Rectangle"
- Ad size: 300x250 (Medium Rectangle)
- Copy the Ad slot ID and update `adSlots.sidebar` in `src/config/ads.ts`

### Inline Ad (Responsive)
- Name: "Inline Content"
- Ad size: Responsive
- Copy the Ad slot ID and update `adSlots.inline` in `src/config/ads.ts`

## Step 5: Update Configuration

Edit `src/config/ads.ts` with your actual values:

```typescript
export const ADSENSE_CONFIG = {
  publisherId: 'ca-pub-YOUR_ACTUAL_ID',
  adSlots: {
    banner: 'YOUR_BANNER_SLOT_ID',
    bannerMobile: 'YOUR_MOBILE_BANNER_SLOT_ID',
    sidebar: 'YOUR_SIDEBAR_SLOT_ID',
    inline: 'YOUR_INLINE_SLOT_ID',
  },
  // ... rest of config
};
```

## Step 6: Test Your Implementation

1. Deploy your updated application
2. Visit your site and check that ad spaces are loading
3. Use browser developer tools to check for any AdSense errors
4. Wait for Google's review process (can take 1-14 days)

## Step 7: Monitor Performance

1. Check your AdSense dashboard regularly
2. Monitor ad performance and earnings
3. Optimize ad placements based on performance data

## Best Practices

### Ad Placement
- Don't place too many ads above the fold
- Ensure ads don't interfere with user experience
- Follow Google's ad placement policies

### Content Guidelines
- Ensure your content complies with AdSense policies
- Avoid prohibited content categories
- Maintain high-quality, original content

### Performance Optimization
- Monitor page load speeds
- Use lazy loading for ads when possible
- Test different ad placements

## Troubleshooting

### Common Issues

1. **Ads not showing**: Check that your Publisher ID and ad slot IDs are correct
2. **Policy violations**: Review Google's AdSense policies and ensure compliance
3. **Low earnings**: Experiment with ad placement and monitor performance metrics

### Debugging

Check browser console for errors:
- Look for AdSense-related error messages
- Ensure the AdSense script is loading properly
- Verify ad units are being initialized

## Privacy and Compliance

### Privacy Policy
Update your privacy policy to include:
- Use of Google AdSense
- Cookie usage for advertising
- Data collection for personalized ads

### GDPR Compliance (if applicable)
- Implement cookie consent if serving EU users
- Provide options for personalized vs non-personalized ads
- Update your privacy policy accordingly

## Revenue Optimization Tips

1. **Strategic Placement**: Place ads where users naturally look
2. **A/B Testing**: Test different ad sizes and placements
3. **Content Quality**: Higher quality content typically leads to better ad rates
4. **User Experience**: Don't sacrifice UX for ad revenue
5. **Analytics**: Use Google Analytics with AdSense for better insights

Remember: It typically takes time to see significant revenue from AdSense. Focus on creating quality content and growing your user base while optimizing ad performance.
