// Safe Linux-only proof: multiple virtual pages alias one file-backed page,
// and a private write copies a page without changing other readers.
// NOT an automatic deduplicator, page allocator or measurement of physical RSS.
#define _GNU_SOURCE
#include <sys/mman.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static void fail(const char *msg){perror(msg);exit(1);}
int main(void){
 const size_t bytes=4096;
 int fd=(int)syscall(SYS_memfd_create,"dram-alias-probe",0);
 if(fd<0)fail("memfd_create");
 if(ftruncate(fd,(off_t)bytes))fail("ftruncate");
 uint8_t *writer=mmap(NULL,bytes,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);
 if(writer==MAP_FAILED)fail("mmap-shared");
 memset(writer,7,bytes);
 if(munmap(writer,bytes))fail("munmap-shared");
 uint8_t *views[4]={0};
 for(int i=0;i<4;i++){
  views[i]=mmap(NULL,bytes,PROT_READ|PROT_WRITE,MAP_PRIVATE,fd,0);
  if(views[i]==MAP_FAILED)fail("mmap-private");
  if(views[i][100]!=7)fail("initial-value");
 }
 views[0][100]=99; // Kernel COW in this one mapping.
 if(views[0][100]!=99)fail("cow-write");
 for(int i=1;i<4;i++)if(views[i][100]!=7)fail("cow-isolation");
 for(int i=0;i<4;i++)if(munmap(views[i],bytes))fail("munmap-private");
 if(close(fd))fail("close");
 puts("DRAM_MEMFD_OK 4 virtual aliases, direct loads, 1 isolated COW write");
 return 0;
}
