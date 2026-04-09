<script setup lang="ts">
import HeroSection from '@/components/home/HeroSection.vue'
import PagesGrid from '@/components/home/PagesGrid.vue'
import ProjectLinksSection from '@/components/home/ProjectLinksSection.vue'
import RecentlyViewed from '@/components/home/RecentlyViewed.vue'
import SiteFooter from '@/components/home/SiteFooter.vue'
import SourceTributeSection from '@/components/home/SourceTributeSection.vue'
import TechStackSection from '@/components/home/TechStackSection.vue'
</script>

<template>
  <div class="min-h-screen bg-bg-deep text-text-primary font-body">
    <HeroSection />
    <PagesGrid />
    <RecentlyViewed />
    <ProjectLinksSection />
    <TechStackSection />
    <SourceTributeSection />
    <SiteFooter />
  </div>
</template>
