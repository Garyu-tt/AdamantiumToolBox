#define _GNU_SOURCE
#include <errno.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <time.h>
#include <unistd.h>
#define MAX_COPIES 4
#define MAX_PAGES 2048
struct counters {uint64_t pss_kb,rss_kb,ksm_kb; int found;};
static int number(const char *s,int min,int max,int *out){
 char *end=NULL;errno=0;long n=strtol(s,&end,10);
 if(errno||!s[0]||*end||n<min||n>max)return -1;
 *out=(int)n;return 0;
}
static int ksm_state(void){
 FILE *f=fopen("/sys/kernel/mm/ksm/run","r");
 if(!f)return -1;
 int n=-1;if(fscanf(f,"%d",&n)!=1)n=-1;
 fclose(f);return n;
}
static uint64_t mix(uint64_t x){
 x^=x>>30;x*=UINT64_C(0xbf58476d1ce4e5b9);
 x^=x>>27;x*=UINT64_C(0x94d049bb133111eb);return x^(x>>31);
}
static void fill(uint8_t *buf,size_t pages,size_t page_size){
 for(size_t p=0;p<pages;p++){
  uint64_t state=mix(p+UINT64_C(0x123456789abcdef));
  for(size_t i=0;i<page_size;i++){
   state=mix(state+i);buf[p*page_size+i]=(uint8_t)state;
  }
 }
}
static struct counters measure(uint8_t **ptrs,size_t copies){
 struct counters out={0};FILE *f=fopen("/proc/self/smaps","r");
 if(!f)return out;
 char *line=NULL;size_t cap=0;int selected=0;
 while(getline(&line,&cap,f)!=-1){
  unsigned long start=0,end=0;
  if(sscanf(line,"%lx-%lx",&start,&end)==2){
   selected=0;
   for(size_t i=0;i<copies;i++){
    const uintptr_t p=(uintptr_t)ptrs[i];
    if(p>=start&&p<end){selected=1;break;}
   }
   if(selected)out.found++;
   continue;
  }
  if(!selected)continue;
  uint64_t val=0;
  if(sscanf(line,"Pss: %" SCNu64 " kB",&val)==1)out.pss_kb+=val;
  else if(sscanf(line,"Rss: %" SCNu64 " kB",&val)==1)out.rss_kb+=val;
  else if(sscanf(line,"KSM: %" SCNu64 " kB",&val)==1)out.ksm_kb+=val;
 }
 free(line);fclose(f);return out;
}
static void output(const char *status,int ksm,int pages,int copies,int wait,
 struct counters pre,struct counters post,int madvise_ok){
 printf("{\"schema\":\"dram-ksm-probe-1\",\"status\":\"%s\","
  "\"kernel_ksm_run\":%d,\"pages_per_copy\":%d,\"copies\":%d,"
  "\"wait_ms\":%d,\"madvise_ok\":%s,\"host_policy_modified\":false,"
  "\"baseline\":{\"pss_kb\":%" PRIu64 ",\"rss_kb\":%" PRIu64 ",\"ksm_kb\":%" PRIu64 "},"
  "\"after\":{\"pss_kb\":%" PRIu64 ",\"rss_kb\":%" PRIu64 ",\"ksm_kb\":%" PRIu64 "},"
  "\"observed_pss_delta_kb\":%" PRId64 ",\"verified_ksm_merging\":%s}\n",
  status,ksm,pages,copies,wait,madvise_ok?"true":"false",
  pre.pss_kb,pre.rss_kb,pre.ksm_kb,post.pss_kb,post.rss_kb,post.ksm_kb,
  (int64_t)pre.pss_kb-(int64_t)post.pss_kb,
  (ksm==1&&post.ksm_kb>pre.ksm_kb)?"true":"false");
}
int main(int argc,char **argv){
 int execute=0,pages=256,copies=3,wait=0;
 for(int i=1;i<argc;i++){
  if(!strcmp(argv[i],"--execute"))execute=1;
  else if(i+1<argc&&!strcmp(argv[i],"--pages")){
   if(number(argv[++i],1,MAX_PAGES,&pages))return 2;
  }else if(i+1<argc&&!strcmp(argv[i],"--copies")){
   if(number(argv[++i],2,MAX_COPIES,&copies))return 2;
  }else if(i+1<argc&&!strcmp(argv[i],"--wait-ms")){
   if(number(argv[++i],0,30000,&wait))return 2;
  }else {fprintf(stderr,"invalid_argument\n");return 2;}
 }
 const int run=ksm_state();struct counters empty={0};
 if(!execute){output("opt_in_required",run,0,0,0,empty,empty,0);return 0;}
 const long size=sysconf(_SC_PAGESIZE);
 if(size<=0||size>65536){fprintf(stderr,"unsupported_page_size\n");return 3;}
 const size_t bytes=(size_t)size*(size_t)pages;
 uint8_t *ptrs[MAX_COPIES]={0};int ok=1;
 for(int i=0;i<copies;i++){
  ptrs[i]=mmap(NULL,bytes,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
  if(ptrs[i]==MAP_FAILED){ptrs[i]=NULL;ok=0;break;}
  fill(ptrs[i],(size_t)pages,(size_t)size);
 }
 if(!ok){perror("mmap");for(int i=0;i<copies;i++)if(ptrs[i])munmap(ptrs[i],bytes);return 3;}
 // Verify identical buffers before asking the kernel to merge anything.
 for(int i=1;i<copies;i++)if(memcmp(ptrs[0],ptrs[i],bytes)){
  fprintf(stderr,"fixture_mismatch\n");return 4;
 }
 const struct counters before=measure(ptrs,(size_t)copies);
 int madvise_ok=1;
 if(run==1){
  for(int i=0;i<copies;i++)if(madvise(ptrs[i],bytes,MADV_MERGEABLE))madvise_ok=0;
  if(madvise_ok&&wait>0){
   struct timespec ts={.tv_sec=wait/1000,.tv_nsec=(wait%1000)*1000000L};
   while(nanosleep(&ts,&ts)&&errno==EINTR){}
  }
 }
 const struct counters after=measure(ptrs,(size_t)copies);
 const char *status=run<0?"unavailable_no_sysfs":run!=1?"disabled_by_host":
  !madvise_ok?"madvise_rejected":!before.found||!after.found?"smaps_unavailable":
  after.ksm_kb>before.ksm_kb?"ksm_pages_observed":"no_merge_observed";
 // Explicit private write tests that another mapping is never mutated.
 const uint8_t original=ptrs[1][0];ptrs[0][0]^=0x5a;
 if(ptrs[1][0]!=original){fprintf(stderr,"isolation_failed\n");return 5;}
 output(status,run,pages,copies,wait,before,after,madvise_ok);
 for(int i=0;i<copies;i++)munmap(ptrs[i],bytes);
 return 0;
}
