<script setup lang="ts">
import HeroSection from '@/components/home/HeroSection.vue'
import PagesGrid from '@/components/home/PagesGrid.vue'
import RecentlyViewed from '@/components/home/RecentlyViewed.vue'
import SiteFooter from '@/components/home/SiteFooter.vue'
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <HeroSection />
    <PagesGrid />
    <RecentlyViewed />
    <SiteFooter />
  </div>
</template>
