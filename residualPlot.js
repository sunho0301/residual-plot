function residualPlot() {
  var opts = {
    width: 800,
    height: 500,
    margin: {
      top: 20,
      right: 20,
      left: 70,
      bottom: 70
    },
    scatter: {
      updateDuration : 1000,
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
      enterDuration: 1000,
      exitDuration: 1000,
      padding: {
        top: 10,
        bottom: 10,
        inner: 0.3,
        outer: 1
      },
      axisTitle: {
        x: 'Data points',
        y: 'Difference from trendline'
      },
      colorPositive: 'green',
      colorNegative: 'red',
      opacity: 0.5
    },
    point: {
      enterDuration: 1000,
      exitDuration: 1000,
      opacity: 0.5,
      size: 5,
      color: 'blue',
      onMouseover: function() {},
      onMouseout: function() {}
    },
    line: {
      opacity: 1,
      width: 2,
      color: '#aaa'
    },
    firstAxisUpdateDuration: 1000,
    secondAxisUpdateDuration: 1000,
    residualMode: false,
    regressionFunction: undefined,
    x: function(d, i) {
      return d.x;
    },
    y: function(d, i) {
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
        if (typeof obj[key] === 'object') {
          createGetSettersFromObject(obj[key], fullPath);
        } else {
          self[fullKey] = newGetSetter(fullPath, sideEffects[fullKey]);
        }
      }
    }
  }

  // Create the get-setters
  createGetSettersFromObject(opts, []);

  /* === Graph Drawing === */

  // Private state
  var lastResidualMode = null;

  function self(selection) {
    selection.each(draw);
  }

  function draw(data) {
    var changingType = false;
    var firstDraw = false;
    if (lastResidualMode !== null) {
      changingType = (opts.residualMode !== lastResidualMode);
    } else {
      firstDraw = true;
    }
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

    var transitions = axisTransitions(changingType, opts.residualMode, firstDraw);

    // Setup the x axis title, or get the one that's already there
    var xAxisTitle = svgEnter
      .append('text')
        .attr('class', 'x-axis-title')
        .attr('text-anchor', 'middle')
      .merge(svg.select('text.x-axis-title'))
        .attr('x', opts.margin.left + (drawWidth / 2))
        .attr('y', opts.margin.top + drawHeight + (opts.margin.bottom / 2))
        .transition()
        .delay(transitions.x.delay)
        .text(opts.residualMode ? opts.bar.axisTitle.x : opts.scatter.axisTitle.x);

    // Setup the y axis title, or get the one that's already there
    var yAxisTitle = svgEnter
      .append('text')
        .attr('class', 'y-axis-title')
        .attr('text-anchor', 'middle')
      .merge(svg.select('text.y-axis-title'))
        .attr('transform',
          'translate(' +
            (opts.margin.left / 2) +
          ',' +
            (opts.margin.top + (drawHeight / 2)) +
          ') rotate(-90)')
        .transition()
        .delay(transitions.y.delay)
        .text(opts.residualMode ? opts.bar.axisTitle.y : opts.scatter.axisTitle.y);

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

    // Make these in this order so that line is on top of points are on top of bars
    var barsContainer = drawArea.selectAll('g.bars-container').data([data]);

    barsContainer = barsContainer.enter()
      .append('g')
      .attr('class', 'bars-container')
      .merge(barsContainer);

    var pointsContainer = drawArea.selectAll('g.points-container').data([data]);

    pointsContainer = pointsContainer.enter()
      .append('g')
      .attr('class', 'points-container')
      .merge(pointsContainer);

    var lineContainer = drawArea.selectAll('g.line-container').data([data]);

    lineContainer = lineContainer.enter()
      .append('g')
      .attr('class', 'line-container')
      .merge(lineContainer);

    var regressionFunction = getRegressionFunction(data);
    var scales = createScales(data, drawWidth, drawHeight, regressionFunction);

    updateAxes(scales, xAxisContainer, yAxisContainer, changingType, firstDraw);
    plotPoints(scales, data, pointsContainer, regressionFunction, changingType);
    plotFit(scales, data, lineContainer, regressionFunction, changingType, barsContainer);

    // We've now drawn the current mode
    lastResidualMode = opts.residualMode;
  }

  function createScales(data, drawWidth, drawHeight, regressionFunction) {
    var xScale;
    var yScale;
    if (opts.residualMode) {
      var residual = getResidualFunction(regressionFunction);

      xScale = d3.scaleBand()
                 .domain(
                      sortBy(data, residual)
                      .map(opts.id)
                  )
                 .range([0, drawWidth])
                 .paddingOuter(opts.bar.padding.outer)
                 .paddingInner(opts.bar.padding.inner);

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

  function updateAxes(scales, xAxisContainer, yAxisContainer, changingType, firstDraw) {
    var xAxis = d3.axisBottom().scale(scales.x);
    var yAxis = d3.axisLeft().scale(scales.y);

    if (opts.residualMode) {
      // Hides tick text
      xAxis.tickFormat("");
    } else {
      // Resets to default, which shows tick text
      xAxis.tickFormat(null);
    }

    var transitions = axisTransitions(changingType, opts.residualMode, firstDraw);

    xAxisContainer
      .transition()
      .duration(transitions.x.duration)
      .delay(transitions.x.delay)
      .call(xAxis);

    yAxisContainer
      .transition()
      .duration(transitions.y.duration)
      .delay(transitions.y.delay)
      .call(yAxis);
  }

  function plotPoints(scales, data, g, regressionFunction, changingType) {
    var residual = getResidualFunction(regressionFunction);

    var points = g.selectAll('circle.point')
      .data(sortBy(data, residual), opts.id);

    points.enter()
      .append('circle')
        .attr('class', 'point')
        .attr('r', opts.point.size)
        .attr('fill', opts.point.color)
        // Fade in, starting at transparent
        .attr('opacity', 0)
        .attr('cx', function(d, i) {
          if (opts.residualMode) {
            return scales.x(opts.id(d, i));
          } else {
            return scales.x(xValue(d, i));
          }
        })
        .attr('cy', function(d, i) {
          if (opts.residualMode) {
            return scales.y(residual(d, i));
          } else {
            return scales.y(yValue(d, i));
          }
        })
        .on('mouseover', opts.point.onMouseover)
        .on('mouseout', opts.point.onMouseout)
        .transition()
        .duration(opts.pointEnterDuration)
        .attr('opacity', opts.point.opacity);

    points.on('mouseover', opts.point.onMouseover)
          .on('mouseout', opts.point.onMouseout);

    var xTransition;
    var yTransition;

    if (opts.residualMode) {
      // Scatter -> bar or bar -> bar
      // Y goes first
      yTransition = points.transition()
        .duration(opts.firstAxisUpdateDuration)
        .attr('cy', function(d, i) {
          return scales.y(residual(d, i));
        });

      xTransition = yTransition.transition()
        .duration(opts.secondAxisUpdateDuration)
        .attr('cx', function(d, i) {
          return scales.x(opts.id(d, i));
        });
    } else if (changingType) {
      // Bar -> scatter
      // X goes first
      xTransition = points.transition()
        .duration(opts.firstAxisUpdateDuration)
        .delay(opts.bar.exitDuration)
        .attr('cx', function(d, i) {
          return scales.x(xValue(d, i));
        });

      yTransition = xTransition.transition()
        .duration(opts.secondAxisUpdateDuration)
        .attr('cy', function(d, i) {
          return scales.y(yValue(d, i));
        });
    } else {
      // Scatter -> scatter is a single transition
      points.transition()
        .duration(opts.scatter.updateDuration)
        .attr('cx', function(d, i) {
          return scales.x(xValue(d, i));
        })
        .attr('cy', function(d, i) {
          return scales.y(yValue(d, i));
        });
    }

    points.exit()
      .transition(opts.point.exitDuration)
      .attr('opacity', 0)
      .remove();
  }

  function plotFit(scales, data, lineG, regressionFunction, changingType, barsG) {
    // The spots we sample the regression function at
    var sampling = [];

    if (opts.residualMode) {
      for (var i = 0; i < 30; i++) {
        sampling.push({
          x: scales.x.domain()[Math.round(i * (data.length / 30))],
          y: 0
        });
      }
    } else {
      var domain = d3.extent(data, opts.x);
      var extent = domain[1] - domain[0];

      for (var i = 0; i < 30; i++) {
        var x = domain[0] + (i * (extent / 30));
        sampling.push({
          x: x,
          y: regressionFunction(x)
        });
      }
    }

    var line = d3.line()
      .x(function(d) { return scales.x(d.x); })
      .y(function(d) { return scales.y(d.y); });

    var lines = lineG.selectAll('path.fit').data([sampling]);

    var transition = lineTransition(changingType, opts.residualMode);

    lines.enter()
      .append('path')
        .attr('class', 'fit')
        .attr('fill', 'none')
        .attr('opacity', 0)
        .attr('d', line)
        .attr('stroke', opts.line.color)
        .attr('stroke-width', opts.line.width)
      .merge(lines)
        .transition()
        .duration(transition.duration)
        .delay(transition.delay)
        .attr('stroke', opts.line.color)
        .attr('stroke-width', opts.line.width)
        .attr('opacity', opts.line.opacity)
        .attr('d', line);

    lines.exit().remove();

    var bars;

    if (opts.residualMode) {
      var residual = getResidualFunction(regressionFunction);
      bars = barsG.selectAll('rect.bar').data(sortBy(data, residual), opts.id);
    } else {
      // All of them should exit if transitioning to a scatterplot
      bars = barsG.selectAll('rect.bar').data([]);
    }

    bars.enter()
      .append('rect')
        .attr('class', 'bar')
        .attr('fill', barFill(residual))
        .attr('opacity', opts.bar.opacity)
        // There are never any entering bars when it's not a bar chart, but
        // scales.x.bandwidth() causes a TypeError (because it's not wrapped in a
        // function).
        .attr('width', opts.residualMode ? scales.x.bandwidth() : null)
        .attr('x', function(d, i) {
          return scales.x(opts.id(d, i)) - (scales.x.bandwidth() / 2);
        })
        .attr('y', scales.y(0))
        .attr('height', 0)
        .transition()
        .duration(opts.bar.enterDuration)
        .delay(changingType ? (opts.firstAxisUpdateDuration + opts.secondAxisUpdateDuration) : opts.firstAxisUpdateDuration)
        .attr('y', barY(residual, scales))
        .attr('height', barHeight(regressionFunction, scales));

    bars
      .transition()
      .duration(opts.firstAxisUpdateDuration)
      .attr('y', barY(residual, scales))
      .attr('height', barHeight(regressionFunction, scales))
      .attr('fill', barFill(residual))
      .transition()
      .duration(opts.secondAxisUpdateDuration)
      .attr('x', function(d, i) {
        return scales.x(opts.id(d, i)) - (scales.x.bandwidth() / 2);
      });

    bars.exit()
      .transition()
      .duration(opts.bar.exitDuration)
      .attr('opacity', 0)
      .remove();
  }

  /* === Helpers === */

  function lineTransition(changingType, residualMode) {
    if (!residualMode) {
      if (changingType) {
        // Bar -> scatter
        return {
          delay: opts.bar.exitDuration + opts.firstAxisUpdateDuration,
          duration: opts.secondAxisUpdateDuration
        };
      } else {
        // Scatter -> scatter
        return {
          delay: 0,
          duration: opts.scatter.updateDuration
        };
      }
    } else {
      // If it's not a scatter, there won't be any real animation anyway
      return {
        delay: 0,
        duration: 1000
      };
    }
  }

  function axisTransitions(changingType, residualMode, firstDraw) {
    if (firstDraw) {
      return {
        y: {
          delay: 0,
          duration: 0
        },
        x: {
          delay: 0,
          duration: 0
        }
      };
    }
    var result = {
      y: {},
      x: {}
    };
    if (residualMode) {
      // Bar -> bar or scatter -> bar, it's the same
      result.y.duration = opts.firstAxisUpdateDuration;
      result.y.delay = 0;

      result.x.duration = opts.secondAxisUpdateDuration;
      result.x.delay = result.y.duration;
    } else if (changingType) {
      // Bar -> scatter
      result.x.duration = opts.firstAxisUpdateDuration;
      result.x.delay = opts.bar.exitDuration;

      result.y.duration = opts.secondAxisUpdateDuration;
      result.y.delay = result.x.delay + result.x.duration;
    } else {
      // Scatter -> scatter
      result.y.duration = result.x.duration = opts.scatterUpdateDuration;
      result.y.delay = result.x.delay = 0;
    }
    return result;
  }

  function barY(residual, scales) {
    return function(d, i) {
      var residualAmount = residual(d, i);
      if (residualAmount > 0) {
        return scales.y(residualAmount);
      } else {
        return scales.y(0);
      }
    }
  }

  function barHeight(regressionFunction, scales) {
    return function(d, i) {
      var startPoint = scales.y(yValue(d, i));
      var endPoint = scales.y(regressionFunction(xValue(d, i)));
      return Math.abs(startPoint - endPoint);
    }
  }

  function barFill(residual) {
    return function(d, i) {
      var residualAmount = residual(d, i);
      if (residualAmount > 0) {
        return opts.bar.colorPositive;
      } else {
        return opts.bar.colorNegative;
      }
    }
  }

  function xValue(d, i) {
    if (typeof opts.x === 'function') {
      return opts.x(d, i);
    } else {
      return opts.x;
    }
  }

  function yValue(d, i) {
    if (typeof opts.y === 'function') {
      return opts.y(d, i);
    } else {
      return opts.y;
    }
  }

  function getRegressionFunction(data) {
    return opts.regressionFunction || linearRegression(data);
  }

  function getResidualFunction(regressionFunction) {
    return function(d, i) {
      return yValue(d, i) - regressionFunction(xValue(d, i));
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
    return array.slice().sort(function(a, b) {
      return func(a) - func(b);
    });
  }

  function linearRegression(data) {
    var regressionPoints = [];

    for (var i = 0; i < data.length; i++) {
      regressionPoints.push([xValue(data[i]), yValue(data[i])]);
    }

    var regression = linear(regressionPoints, null, {precision: 2});
    var gradient = regression.equation[0];
    var intercept = regression.equation[1];

    return function(x) {
      return (gradient * x) + intercept;
    };
  }

  /* === REGRESSION.JS === */
  // The following code is taken wholesale from https://github.com/Tom-Alexander/regression-js/blob/master/src/regression.js

  /**
   * Determine the coefficient of determination (r^2) of a fit from the observations and predictions.
   *
   * @param {Array<Array<number>>} observations - Pairs of observed x-y values
   * @param {Array<Array<number>>} predictions - Pairs of observed predicted x-y values
   *
   * @return {number} - The r^2 value, or NaN if one cannot be calculated.
   */
  function determinationCoefficient(observations, predictions) {
    var sum = observations.reduce(function (accum, observation) { return accum + observation[1]; }, 0);
    var mean = sum / observations.length;

    // Sum of squares of differences from the mean in the dependent variable
    var ssyy = observations.reduce(function (accum, observation) {
      var diff = observation[1] - mean;
      return accum + diff * diff;
    }, 0);

    // Sum of squares of resudulals
    var sse = observations.reduce(function (accum, observation, ix) {
      var prediction = predictions[ix];
      var resid = observation[1] - prediction[1];
      return accum + resid * resid;
    }, 0);

    // If ssyy is zero, r^2 is meaningless, so NaN is an appropriate answer.
    return 1 - (sse / ssyy);
  }

  /** Precision to use when displaying string form of equation */
  var _DEFAULT_PRECISION = 2;

  /**
   * Round a number to a precision, specificed in number of decimal places
   *
   * @param {number} number - The number to round
   * @param {number} precision - The number of decimal places to round to:
   *                             > 0 means decimals, < 0 means powers of 10
   *
   *
   * @return {numbr} - The number, rounded
   */
  function _round(number, precision) {
    var factor = Math.pow(10, precision);
    return Math.round(number * factor) / factor;
  }

  function linear(data, _order, options) {
    var sum = [0, 0, 0, 0, 0];
    var results;
    var gradient;
    var intercept;
    var len = data.length;

    for (var n = 0; n < len; n++) {
      if (data[n][1] !== null) {
        sum[0] += data[n][0];
        sum[1] += data[n][1];
        sum[2] += data[n][0] * data[n][0];
        sum[3] += data[n][0] * data[n][1];
        sum[4] += data[n][1] * data[n][1];
      }
    }

    gradient = (len * sum[3] - sum[0] * sum[1]) / (len  * sum[2] - sum[0] * sum[0]);
    intercept = (sum[1] / len) - (gradient * sum[0]) / len;

    results = data.map(function (xyPair) {
      var x = xyPair[0];
      return [x, gradient * x + intercept];
    });

    return {
      r2: determinationCoefficient(data, results),
      equation: [gradient, intercept],
      points: results,
      string: 'y = ' + _round(gradient, options.precision) + 'x + ' + _round(intercept, options.precision)
    };
  }

  return self;
}
