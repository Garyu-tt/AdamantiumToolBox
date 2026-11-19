#pragma once
#include <QImage>
#include <QJsonArray>
#include <QWidget>
#include <cstdint>
class QPainter;
class SvgCanvas final:public QWidget {
public:
 using QWidget::QWidget;
 bool setSvg(const QByteArray& svg);
 std::uint64_t rasterPasses() const noexcept {return rasterPasses_;}
 std::uint64_t cacheHits() const noexcept {return cacheHits_;}
protected:
 void paintEvent(QPaintEvent*) override;
 void changeEvent(QEvent*) override;
private:
 void renderScene(QPainter& painter);
 QImage buffer_;
 QByteArray lastSvg_;
 std::uint64_t rasterPasses_=0,cacheHits_=0;
 QJsonArray scene_;
 double logicalWidth_=512,logicalHeight_=512;
};
