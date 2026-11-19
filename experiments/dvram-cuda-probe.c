// Read-only CUDA Driver API feature query. No context, VMM allocation or kernel.
#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
// CUDA headers (NVIDIA CUDA 11+): CU_DEVICE_ATTRIBUTE_VIRTUAL_MEMORY_MANAGEMENT_SUPPORTED=102.
#define CUDA_VMM_ATTRIBUTE 102
#define MAX_DEVICES 64

typedef int (*InitFn)(unsigned int);
typedef int (*CountFn)(int *);
typedef int (*DeviceFn)(int *,int);
typedef int (*AttrFn)(int *,int,int);
typedef int (*VersionFn)(int *);
typedef int (*ComputeFn)(int *,int *,int);

static void report(const char *status){
 printf("{\"schema\":\"dvram-cuda-capabilities-1\",\"status\":\"%s\","
  "\"probed\":false,\"device_count\":0,\"devices\":[],\"changes\":false}\n",status);
}
int main(int argc,char **argv){
 if(argc!=2||strcmp(argv[1],"--probe")){
  report("opt_in_required");return 0;
 }
 void *lib=dlopen("libcuda.so.1",RTLD_LAZY|RTLD_LOCAL);
 if(!lib){report("cuda_driver_not_found");return 0;}
 InitFn init=(InitFn)dlsym(lib,"cuInit");
 CountFn count=(CountFn)dlsym(lib,"cuDeviceGetCount");
 DeviceFn device=(DeviceFn)dlsym(lib,"cuDeviceGet");
 AttrFn attr=(AttrFn)dlsym(lib,"cuDeviceGetAttribute");
 VersionFn version=(VersionFn)dlsym(lib,"cuDriverGetVersion");
 ComputeFn compute=(ComputeFn)dlsym(lib,"cuDeviceComputeCapability");
 if(!init||!count||!device||!attr||!version||!compute){
  report("cuda_driver_api_missing_symbols");dlclose(lib);return 0;
 }
 int api=0,n=0,err=init(0);
 if(err){
  printf("{\"schema\":\"dvram-cuda-capabilities-1\",\"status\":\"cuinit_failed\","
   "\"cuda_error_code\":%d,\"probed\":false,\"devices\":[],\"changes\":false}\n",err);
  dlclose(lib);return 0;
 }
 if(version(&api)||count(&n)||n<0){report("driver_query_failed");dlclose(lib);return 0;}
 printf("{\"schema\":\"dvram-cuda-capabilities-1\",\"status\":\"%s\","
  "\"probed\":true,\"cuda_driver_api_version\":%d,\"device_count\":%d,\"devices\":[",
  n==0?"no_devices":n>MAX_DEVICES?"truncated":"ok",api,n);
 int limit=n<MAX_DEVICES?n:MAX_DEVICES;
 for(int i=0;i<limit;i++){
  int d=0,maj=0,min=0,vmm=0,rc=device(&d,i);
  if(!rc)rc=compute(&maj,&min,d);
  if(!rc)rc=attr(&vmm,CUDA_VMM_ATTRIBUTE,d);
  if(i)putchar(',');
  printf("{\"index\":%d,\"query_ok\":%s,\"cuda_error_code\":%d,"
   "\"compute_major\":%d,\"compute_minor\":%d,\"cuda_vmm_supported\":%s}",
   i,rc?"false":"true",rc,maj,min,!rc&&vmm?"true":"false");
 }
 puts("],\"changes\":false}");
 dlclose(lib);return 0;
}
