#include "svg_canvas.hpp"
#include <QApplication>
#include <QImage>
#include <iostream>
int main(int argc,char** argv){
 QApplication app(argc,argv);
 SvgCanvas canvas;canvas.resize(320,200);
 const QByteArray svg="<svg xmlns=\"http://www.w3.org/2000/svg\" "
  "width=\"320\" height=\"200\"><rect x=\"0\" y=\"0\" "
  "width=\"320\" height=\"200\" fill=\"#345678\"/></svg>";
 if(!canvas.setSvg(svg))return 1;
 canvas.show();QCoreApplication::processEvents();
 const auto before=canvas.grab().toImage();
 if(before.isNull())return 2;
 canvas.repaint();
 if(canvas.grab().toImage()!=before)return 3;
 if(canvas.setSvg("<!DOCTYPE svg [<!ENTITY e SYSTEM 'file:///etc/passwd'>]>"
  "<svg xmlns=\"http://www.w3.org/2000/svg\"/>"))return 4;
 if(canvas.setSvg("<svg xmlns=\"http://www.w3.org/2000/svg\"><script/></svg>"))return 5;
 if(canvas.setSvg(QByteArray(111000,'x')))return 6;
 std::cout<<"MAS_LEONARDO_NATIVE_OK scene validation and stable cached pixels\n";
}
