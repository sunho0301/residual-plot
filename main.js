function correlationScatterplot() {
  var opts = {
    width: 800,
    height: 500,
    margin: {
      top: 20,
      right: 20,
      left: 20,
      bottom: 20
    },
    scatter: {
      padding: {
        top: 10,
        right: 10,
        left: 10,
        bottom: 10
      },
      axisTitle: {
        x: 'X',
        y: 'Y'
      }
    },
    bar: {
      padding: {
        top: 10,
        bottom: 10,
        inner: 0.3,
        outer: 1
      },
      axisTitle: {
        x: 'Data points',
        y: 'Difference from trendline'
      }
    },
    correlationResidual: false,
    regressionFunction: null,
    x: function(d) {
      return d.x;
    },
    y: function(d) {
      return d.y;
    },
    id: function(d, i) {
      return i;
    }
  };

  // Setter side effects, on a per-option basis
  var sideEffects = {
  };

  // Helper to create getter/setters
  function newGetSetter(attrList, sideEffect) {
    var attrsLeft = attrList.slice();
    var obj = opts;
    while (attrsLeft.length > 1) {
      obj = obj[attrsLeft[0]];
      attrsLeft = attrsLeft.slice(1);
    }
    var attr = attrsLeft[0];
    return function(_) {
      if (!arguments.length) {
        return obj[attr];
      }
      obj[attr] = _;
      if (sideEffect) {
        sideEffect();
      }
      return self;
    };
  }

  function createGetSettersFromObject(obj, namespace) {
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var fullPath = namespace.concat(key);
        var fullKey = camelCase(fullPath);
        self[fullKey] = newGetSetter(fullPath, sideEffects[fullKey]);
        if (typeof obj[key] === 'object') {
          createGetSettersFromObject(obj[key], fullPath);
        }
      }
    }
  }

  // Create the get-setters
  createGetSettersFromObject(opts, []);

  /* === Graph Drawing === */

  function self(selection) {
    selection.each(draw);
  }

  function draw(data) {
    // Element is passed as the call context
    var elem = d3.select(this);

    // Bind either 0 or 1 <svg>s to a single-element array. If enter's not empty,
    // that means we need to do initial setup.
    var svg = elem.selectAll('svg').data([data]);

    var drawWidth = opts.width - opts.margin.left - opts.margin.right;
    var drawHeight = opts.height - opts.margin.top - opts.margin.bottom;

    var svgEnter = svg.enter()
      .append('svg')
        .attr('height', opts.height)
        .attr('width', opts.width);

    // Setup the x axis container, or get the one that's already there
    var xAxisContainer = svgEnter
      .append('g')
        .attr('class', 'x-axis-container')
        .attr('transform', 'translate(' + opts.margin.left + ', ' + (opts.margin.top + drawHeight) + ')')
      .merge(svg.select('g.x-axis-container'));

    // Setup the y axis container, or get the one that's already there
    var yAxisContainer = svgEnter
      .append('g')
        .attr('class', 'y-axis-container')
        .attr('transform', 'translate(' + opts.margin.left + ', ' + opts.margin.top + ')')
      .merge(svg.select('g.y-axis-container'));

    // Setup the draw area, or get the one that's already there
    var drawArea = svgEnter
      .append('g')
        .attr('class', 'draw-area')
        .attr('transform', 'translate(' + opts.margin.left + ', ' + opts.margin.right + ')')
        .attr('height', drawHeight)
        .attr('width', drawWidth)
      .merge(svg.select('g.draw-area'));

    var regressionFunction = getRegressionFunction(data);
    var scales = createScales(data, drawWidth, drawHeight, regressionFunction);

    updateAxes(scales, xAxisContainer, yAxisContainer);
    plotPoints(scales, data, drawArea, regressionFunction);
    plotFit(scales, data, drawArea, regressionFunction);
  }

  function createScales(data, drawWidth, drawHeight, regressionFunction) {
    var xScale;
    var yScale;
    if (opts.correlationResidual) {
      var residual = getResidualFunction(regressionFunction);

      xScale = d3.scaleBand()
                 .domain(
                      sortBy(data.slice(), residual)
                      .map(opts.id)
                  )
                 .range([0, drawWidth]);

      xScale.paddingOuter(opts.bar.padding.outer).paddingInner(opts.bar.padding.inner);

      var yMin = d3.min(data, residual);
      var yMax = d3.max(data, residual);
      yScale = d3.scaleLinear()
                      .domain([
                        yMin - opts.bar.padding.top,
                        yMax + opts.bar.padding.bottom
                      ])
                      .range([drawHeight, 0]);
    } else {
      var xMin = d3.min(data, xValue);
      var xMax = d3.max(data, xValue);

      xScale = d3.scaleLinear()
                      .domain([
                        xMin - opts.scatter.padding.left,
                        xMax + opts.scatter.padding.right
                      ])
                      .range([0, drawWidth]);

      var yMin = d3.min(data, yValue);
      var yMax = d3.max(data, yValue);

      yScale = d3.scaleLinear()
                      .domain([
                        yMin - opts.scatter.padding.bottom,
                        yMax + opts.scatter.padding.top
                      ])
                      .range([drawHeight, 0]);
    }
    return {x: xScale, y: yScale};
  }

  function updateAxes(scales, xAxisContainer, yAxisContainer) {
    var xAxis = d3.axisBottom().scale(scales.x);
    var yAxis = d3.axisLeft().scale(scales.y);

    if (opts.correlationResidual) {
      // Hides tick text
      xAxis.tickFormat("");
    } else {
      // Resets to default, which shows tick text
      xAxis.tickFormat(null);
    }

    xAxisContainer
      .transition()
      .duration(3000)
      .call(xAxis);

    yAxisContainer
      .transition()
      .duration(3000)
      .call(yAxis);
  }

  function plotPoints(scales, data, g, regressionFunction) {
    var residual = getResidualFunction(regressionFunction);

    var points = g.selectAll('circle.point')
      .data(sortBy(data, residual), opts.id);

    points.enter()
      .append('circle')
        .attr('class', 'point')
        .attr('r', 5)
        .attr('fill', 'blue')
        // Fade in, starting at transparent
        .attr('opacity', 0)
        .attr('cx', function(d) {
          return scales.x(xValue(d));
        })
        .attr('cy', function(d) {
          if (opts.correlationResidual) {
            return scales.y(residual(d));
          } else {
            return scales.y(yValue(d));
          }
        })
        .transition()
        .duration(1000)
        .attr('opacity', 0.5);

    var xTransition;
    var yTransition;

    if (opts.correlationResidual) {
      // Y goes first
      yTransition = points.transition()
        .duration(1000)
        .attr('cy', function(d) {
          return scales.y(residual(d));
        });

      xTransition = yTransition.transition()
        .duration(1000)
        .attr('cx', function(d, i) {
          return scales.x(opts.id(d, i));
        });
    } else {
      // X goes first
      xTransition = points.transition()
        .delay(1000)
        .duration(1000)
        .attr('cx', function(d, i) {
          if (opts.correlationResidual) {
            return scales.x(opts.id(d, i));
          } else {
            return scales.x(xValue(d));
          }
        });

      yTransition = xTransition.transition()
        .duration(1000)
        .attr('cy', function(d) {
          if (opts.correlationResidual) {
            return scales.y(residual(d));
          } else {
            return scales.y(yValue(d));
          }
        });
    }

    points.exit()
      .transition(1000)
      .attr('opacity', 0)
      .remove();
  }

  function plotFit(scales, data, g, regressionFunction) {
    // The spots we sample the regression function at
    var sampling = [];

    if (opts.correlationResidual) {
      for (var i = 0; i < 29; i++) {
        sampling.push({
          x: scales.x.domain()[Math.round(i * (data.length / 30))],
          y: 0
        });
      }

      sampling.push({
        x: scales.x.domain()[scales.x.domain().length - 1],
        y: 0
      });
    } else {
      var domain = d3.extent(data, opts.x);
      var extent = domain[1] - domain[0];

      for (var i = 0; i < 30; i++) {
        var x = domain[0] + (i * (extent / 30));
        sampling.push({
          x: x,
          y: opts.regressionFunction(x)
        });
      }
    }

    var line = d3.line()
      .x(function(d) { return scales.x(d.x); })
      .y(function(d) { return scales.y(d.y); });

    var lines = g.selectAll('path.fit').data([sampling]);

    lines.enter()
      .append('path')
        .attr('class', 'fit')
        .attr('stroke', 'blue')
        .attr('d', line)
      .merge(lines)
        .transition()
        .duration(1000)
        .delay(opts.correlationResidual ? 0 : 2000)
        .attr('d', line);

    lines.exit().remove();

    var bars;

    if (opts.correlationResidual) {
      var residual = getResidualFunction(regressionFunction);

      bars = g.selectAll('rect.bar').data(sortBy(data, residual), opts.id);
    } else {
      bars = g.selectAll('rect.bar').data([]);
    }

    bars.enter()
      .append('rect')
        .attr('class', 'bar')
        .attr('fill', function(d) {
          var residualAmount = residual(d);
          if (residualAmount > 0) {
            return 'green';
          } else {
            return 'red';
          }
        })
        .attr('opacity', 0.5)
        // There are never any entering bars when it's not a bar chart, but
        // scales.x.bandwidth() causes a TypeError (because it's not in a
        // function).
        .attr('width', opts.correlationResidual ? scales.x.bandwidth() : null)
        .attr('x', function(d, i) {
          return scales.x(opts.id(d, i)) - (scales.x.bandwidth() / 2);
        })
        .attr('y', function(d) {
          return scales.y(0);
        })
        .attr('height', 0)
      .merge(bars)
        .transition()
        .duration(1000)
        .delay(2000)
        .attr('x', function(d, i) {
          return scales.x(opts.id(d, i)) - (scales.x.bandwidth() / 2);
        })
        .attr('y', function(d) {
          var residualAmount = residual(d);
          if (residualAmount > 0) {
            return scales.y(residualAmount);
          } else {
            return scales.y(0);
          }
        })
        .attr('height', function(d) {
          var startPoint = scales.y(yValue(d));
          var endPoint = scales.y(regressionFunction(xValue(d)));
          return Math.abs(startPoint - endPoint);
        });

    bars.exit()
      .transition()
      .duration(1000)
      .attr('opacity', 0)
      .remove();
  }

  /* === Helpers === */

  function xValue(d) {
    if (typeof opts.x === 'function') {
      return opts.x(d);
    } else {
      return opts.x;
    }
  }

  function yValue(d) {
    if (typeof opts.y === 'function') {
      return opts.y(d);
    } else {
      return opts.y;
    }
  }

  function getRegressionFunction(data) {
    return opts.regressionFunction || linearRegression(data);
  }

  function getResidualFunction(regressionFunction) {
    return function(d) {
      return yValue(d) - regressionFunction(xValue(d));
    };
  }

  function camelCase(array) {
    if (array.length === 0) {
      return '';
    } else {
      return array[0] + array.slice(1).map(capitalizeFirstLetter).join('');
    }
  }

  function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  function sortBy(array, func) {
    return array.sort(function(a, b) {
      return func(a) - func(b);
    });
  }

  return self;
}
